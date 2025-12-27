/**
 * HDC Engine 单元测试
 */

import { HDCEngine } from '../src/hdc/HDCEngine.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('HDCEngine', () => {
  const hdc = new HDCEngine(10000, 42);

  describe('符号编码', () => {
    it('相同符号应该产生相同向量', () => {
      const v1 = hdc.getSymbolVector('test');
      const v2 = hdc.getSymbolVector('test');
      const sim = hdc.similarity(v1, v2);
      assert.strictEqual(sim.similarity, 1.0);
    });

    it('不同符号应该产生近似正交的向量', () => {
      const v1 = hdc.getSymbolVector('apple');
      const v2 = hdc.getSymbolVector('banana');
      const sim = hdc.similarity(v1, v2);
      assert.ok(sim.similarity > 0.4 && sim.similarity < 0.6);
    });
  });

  describe('绑定操作', () => {
    it('绑定后解绑应恢复原向量', () => {
      const key = hdc.getSymbolVector('key');
      const value = hdc.getSymbolVector('value');
      const bound = hdc.bind(key, value);
      const unbound = hdc.unbind(bound, key);
      const sim = hdc.similarity(unbound, value);
      assert.strictEqual(sim.similarity, 1.0);
    });
  });

  describe('叠加操作', () => {
    it('叠加多个向量后应与各成分相似', () => {
      const vectors = ['a', 'b', 'c'].map(s => hdc.getSymbolVector(s));
      const bundled = hdc.bundle(vectors);
      
      for (const v of vectors) {
        const sim = hdc.similarity(bundled, v);
        assert.ok(sim.similarity > 0.5, '叠加后应与成分相似');
      }
    });
  });

  describe('三元组编码', () => {
    it('编码应在合理时间内完成', () => {
      const result = hdc.encodeTriple('subject', 'predicate', 'object');
      assert.ok(result.encodingTime < 10, '编码时间应小于10ms');
      assert.ok(result.vector.length > 0, '应产生非空向量');
    });
  });

  describe('可复现性', () => {
    it('相同种子应产生相同结果', () => {
      const hdc1 = new HDCEngine(10000, 12345);
      const hdc2 = new HDCEngine(10000, 12345);
      
      const v1 = hdc1.getSymbolVector('test');
      const v2 = hdc2.getSymbolVector('test');
      
      const sim = hdc1.similarity(v1, v2);
      assert.strictEqual(sim.similarity, 1.0);
    });
  });
});

console.log('✅ HDC Engine 测试文件已创建');

