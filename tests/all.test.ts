/**
 * Cross-platform test entrypoint.
 *
 * Windows 的 npm script 不会自动展开 glob（例如 tests/<glob>.test.ts），
 * 因此使用显式入口来 import 所有测试文件，保证 `npm test` 可复现运行。
 */

import './hdc.test.ts';
import './graph-manager.test.ts';
import './hspec-scheduler.test.ts';
