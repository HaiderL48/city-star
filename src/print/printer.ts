import { PermissionsAndroid, Platform } from 'react-native';

import { fail } from '@/lib/errors';
import type { PaperWidth } from '@/db/types';
import type { ReceiptModel } from '@/print/share';

export type PrinterDevice = {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
};

type DriverModule = typeof import('react-native-thermal-printer-driver');

export function paperDots(width: PaperWidth) {
  return width === '80' ? 576 : 384;
}

export function normalizeAddress(device: { address: string; deviceType?: string }) {
  const address = device.address.trim();
  if (/^(bt|ble|tcp):/i.test(address)) return address;
  if (device.deviceType === 'ble') return `ble:${address}`;
  return `bt:${address}`;
}

export function isEverycom(name: string) {
  return /everycom|ec-?\d|printer|thermal|pos|btp|mtp|blue/i.test(name);
}

async function loadDriver(): Promise<DriverModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    const mod = await import('react-native-thermal-printer-driver');
    return mod;
  } catch {
    return null;
  }
}

function driverApi(mod: DriverModule) {
  return mod.default ?? mod;
}

function raise(error: unknown): never {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : error instanceof Error
        ? error.message
        : '';
  const upper = code.toUpperCase();
  if (upper.includes('DISABLED') || upper.includes('BT_DISABLED')) fail('disabled');
  if (
    upper.includes('PERMISSION') ||
    upper.includes('BT_PERMISSION') ||
    upper.includes('SCAN_FAILED') ||
    upper.includes('SECURITY')
  ) {
    fail('permission');
  }
  if (upper.includes('TIMEOUT')) fail('timeout');
  if (upper.includes('BLUETOOTH') || upper.includes('SCAN_ERROR') || upper.includes('BT_NOT')) fail('network');
  if (error instanceof Error && /native module|not found|cannot find/i.test(error.message)) fail('needs_build');
  fail('print_failed');
}

/** Library does not request runtime Bluetooth permissions — do it before scan/connect. */
export async function ensureBluetoothPermissions() {
  if (Platform.OS !== 'android') return;
  const api = typeof Platform.Version === 'number' ? Platform.Version : Number.parseInt(String(Platform.Version), 10);
  const wanted =
    api >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const missing: (typeof wanted)[number][] = [];
  for (const permission of wanted) {
    const granted = await PermissionsAndroid.check(permission);
    if (!granted) missing.push(permission);
  }
  if (!missing.length) return;

  const result = await PermissionsAndroid.requestMultiple(missing);
  const denied = missing.some((permission) => result[permission] !== PermissionsAndroid.RESULTS.GRANTED);
  if (denied) fail('permission');
}

export async function printerAvailable() {
  const driver = await loadDriver();
  return Boolean(driver);
}

export async function scanPrinters(): Promise<{ paired: PrinterDevice[]; found: PrinterDevice[] }> {
  if (Platform.OS === 'web') fail('web_only');
  await ensureBluetoothPermissions();
  const driver = await loadDriver();
  if (!driver) fail('needs_build');
  try {
    const result = await driverApi(driver).scan();
    const map = (device: { name?: string; address: string; deviceType: PrinterDevice['deviceType'] }): PrinterDevice => ({
      name: device.name?.trim() || device.address,
      address: normalizeAddress(device),
      deviceType: device.deviceType,
    });
    return {
      paired: (result.paired ?? []).map(map),
      found: (result.found ?? []).map(map),
    };
  } catch (error) {
    raise(error);
  }
}

export async function connectPrinter(address: string) {
  await ensureBluetoothPermissions();
  const driver = await loadDriver();
  if (!driver) fail(Platform.OS === 'web' ? 'web_only' : 'needs_build');
  try {
    const api = driverApi(driver);
    const ready = await api.isConnected(address);
    if (!ready) await api.connect(address, { timeout: 12000 });
  } catch (error) {
    raise(error);
  }
}

export async function disconnectPrinter(address?: string) {
  const driver = await loadDriver();
  if (!driver) return;
  try {
    await driverApi(driver).disconnect(address);
  } catch {
    // Already gone.
  }
}

async function ensure(address: string) {
  if (!address) fail('connect_first');
  await connectPrinter(address);
}

export async function printReceipt(input: {
  address: string;
  paper: PaperWidth;
  model: ReceiptModel;
  base64?: string | null;
}) {
  if (Platform.OS === 'web') fail('web_only');
  const driver = await loadDriver();
  if (!driver) fail('needs_build');
  await ensure(input.address);
  const width = paperDots(input.paper);
  const api = driverApi(driver);
  try {
    if (input.base64) {
      await api.print(
        input.address,
        [driver.image({ base64: input.base64, width }), driver.feed(2), driver.cut()],
        { paperWidthMm: Number(input.paper) as 58 | 80, keepAlive: true, timeout: 20000 },
      );
      return;
    }
    const nodes = [
      driver.text(input.model.shopName, { align: 'center', bold: true, size: 2 }),
      driver.text(`${input.model.number}  ${input.model.date}`, { align: 'center' }),
      driver.text(input.model.party, { align: 'center' }),
      driver.line({ style: 'dashed' }),
      ...input.model.lines.flatMap((line) => [driver.text(line.name), driver.text(`${line.detail} ${line.amount}`)]),
      driver.line(),
      ...input.model.rows.map((row) => driver.text(`${row.label}  ${row.value}`)),
      driver.text(`${input.model.totalLabel}  ${input.model.total}`, { bold: true }),
      driver.text(input.model.thanks, { align: 'center' }),
      driver.feed(3),
      driver.cut(),
    ];
    await api.print(input.address, nodes, { paperWidthMm: Number(input.paper) as 58 | 80, keepAlive: true });
  } catch (error) {
    raise(error);
  }
}

export async function printTest(address: string, paper: PaperWidth, shopName: string) {
  if (Platform.OS === 'web') fail('web_only');
  const driver = await loadDriver();
  if (!driver) fail('needs_build');
  await ensure(address);
  const api = driverApi(driver);
  try {
    await api.print(
      address,
      [
        driver.text('CITY STAR', { align: 'center', bold: true, size: 2 }),
        driver.text(shopName || 'Everycom test', { align: 'center' }),
        driver.line(),
        driver.text('Test receipt OK', { align: 'center' }),
        driver.text(new Date().toLocaleString('en-IN'), { align: 'center' }),
        driver.feed(3),
        driver.cut(),
      ],
      { paperWidthMm: Number(paper) as 58 | 80, keepAlive: true },
    );
  } catch (error) {
    raise(error);
  }
}

export async function kickDrawer(address: string) {
  if (Platform.OS === 'web') fail('web_only');
  const driver = await loadDriver();
  if (!driver) fail('needs_build');
  await ensure(address);
  const api = driverApi(driver);
  try {
    const bytes = new driver.ESCPOSBuilder().init().cashDrawer().bytes();
    await api.printRaw(address, bytes, { timeout: 8000, keepAlive: true });
  } catch (error) {
    raise(error);
  }
}

export async function captureReceipt(view: unknown) {
  if (Platform.OS === 'web' || !view) return null;
  try {
    const shot = await import('react-native-view-shot');
    const data = await shot.captureRef(view as never, { format: 'png', quality: 1, result: 'base64' });
    return String(data).replace(/\s/g, '');
  } catch {
    return null;
  }
}
