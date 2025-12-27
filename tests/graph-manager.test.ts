/**
 * GraphManager 单元测试（SQLite + embedding 存取 + 检索闭环）
 *
 * 目标：保证在“干净机器/纯 CPU/无模型文件”的情况下，核心数据结构仍可工作，
 * 这是工程最基本的底线（可复现、可运行、可验证）。
 */

import assert from 'node:assert';
import { describe, it, after } from 'node:test';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { GraphManager } from '../src/graph/GraphManager.js';

function tmpDbPath(name: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tnsec-'));
  return path.join(dir, name);
}

describe('GraphManager', () => {
  it('应能写入并读取 embedding（Float32Array BLOB round-trip）', () => {
    const dbPath = tmpDbPath('graph-roundtrip.db');
    const graph = new GraphManager(dbPath);

    const emb = new Float32Array([1, -1, 1, -1, 1, -1, 1, -1]);
    const node = graph.addNode({
      label: 'A',
      type: 'concept',
      karma: 1.0,
      embedding: emb,
      metadata: { tag: 'test' },
    });

    const loaded = graph.getNode(node.id);
    assert.ok(loaded, '应能读回节点');
    assert.ok(loaded.embedding, '应能读回 embedding');
    assert.strictEqual(loaded.embedding!.length, emb.length, 'embedding 长度应一致');
    assert.deepStrictEqual(Array.from(loaded.embedding!), Array.from(emb), 'embedding 内容应一致');

    graph.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('searchByHDC 应返回 topK 且按相似度排序', async () => {
    const dbPath = tmpDbPath('graph-search.db');
    const graph = new GraphManager(dbPath);

    const vecA = new Float32Array([1, -1, 1, -1]);
    const vecB = new Float32Array([1, 1, -1, -1]);
    const vecC = new Float32Array([-1, -1, -1, -1]);

    const a = graph.addNode({ label: 'A', type: 'concept', karma: 1.0, embedding: vecA });
    graph.addNode({ label: 'B', type: 'concept', karma: 0.9, embedding: vecB });
    graph.addNode({ label: 'C', type: 'concept', karma: 0.8, embedding: vecC });

    const results = await graph.searchByHDC(vecA, 2);
    assert.strictEqual(results.length, 2, '应返回 topK 个结果');
    assert.strictEqual(results[0].node.id, a.id, '与查询向量完全一致的节点应排第一');
    assert.strictEqual(results[0].similarity, 1, '完全一致应为 1.0 相似度');
    assert.ok(results[0].similarity >= results[1].similarity, '应按相似度降序');

    graph.close();
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  after(() => {
    // 这里保持空：每个测试自行清理临时目录
  });
});


