import { Platform } from 'react-native';

import { fail } from '@/lib/errors';
import type { PaperWidth } from '@/db/types';
import type { ReceiptModel } from '@/print/share';

export type PrinterDevice = {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
};

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

async function loadDriver() {
  if (Platform.OS === 'web') return null;
  try {
    return await import('react-native-thermal-printer-driver');
  } catch {
    return null;
  }
}

function raise(error: unknown): never {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code.includes('DISABLED')) fail('disabled');
  if (code.includes('PERMISSION')) fail('permission');
  if (code.includes('TIMEOUT')) fail('timeout');
  if (code.includes('BLUETOOTH')) fail('network');
  if (error instanceof Error && /native module|not found|cannot find/i.test(error.message)) fail('needs_build');
  fail('print_failed');
}

export async function printerAvailable() {
  const driver = await loadDriver();
  return Boolean(driver);
}

export async function scanPrinters(): Promise<{ paired: PrinterDevice[]; found: PrinterDevice[] }> {
  if (Platform.OS === 'web') fail('web_only');
  const driver = await loadDriver();
  if (!driver) fail('needs_build');
  try {
    const result = await driver.default.scan();
    const map = (device: { name?: string; address: string; deviceType: PrinterDevice['deviceType'] }): PrinterDevice => ({
      name: device.name?.trim() || device.address,
      address: normalizeAddress(device),
      deviceType: device.deviceType,
    });
    return {
      paired: result.paired.map(map),
      found: result.found.map(map),
    };
  } catch (error) {
    raise(error);
  }
}

export async function connectPrinter(address: string) {
  const driver = await loadDriver();
  if (!driver) fail(Platform.OS === 'web' ? 'web_only' : 'needs_build');
  try {
    const ready = await driver.default.isConnected(address);
    if (!ready) await driver.default.connect(address, { timeout: 12000 });
  } catch (error) {
    raise(error);
  }
}

export async function disconnectPrinter(address?: string) {
  const driver = await loadDriver();
  if (!driver) return;
  try {
    await driver.default.disconnect(address);
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
  try {
    if (input.base64) {
      await driver.default.print(
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
    await driver.default.print(input.address, nodes, { paperWidthMm: Number(input.paper) as 58 | 80, keepAlive: true });
  } catch (error) {
    raise(error);
  }
}

export async function printTest(address: string, paper: PaperWidth, shopName: string) {
  if (Platform.OS === 'web') fail('web_only');
  const driver = await loadDriver();
  if (!driver) fail('needs_build');
  await ensure(address);
  try {
    await driver.default.print(
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
  try {
    const bytes = new driver.ESCPOSBuilder().init().cashDrawer().bytes();
    await driver.default.printRaw(address, bytes, { timeout: 8000, keepAlive: true });
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
