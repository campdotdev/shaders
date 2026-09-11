// The freshness test. The map data is hand-authored, so this is what keeps it
// honest: every path it names must exist in the repo, and every reference
// between neighborhoods, modules, and steps must resolve. When a file moves,
// this fails, and the fix is a one-line edit to the data.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { moduleById, MODULES, neighborhoodById, NEIGHBORHOODS } from '@/data';
import { FLOWS } from '@/data/flows';

// src/data -> src -> apps/map -> apps -> repo root
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

function exists(repoRelativePath: string): boolean {
  return existsSync(resolve(REPO_ROOT, repoRelativePath));
}

describe('map data', () => {
  it('has at least one flow', () => {
    expect(FLOWS.length).toBeGreaterThan(0);
  });

  it('uses each neighborhood id once', () => {
    const ids = NEIGHBORHOODS.map((neighborhood) => neighborhood.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses each module id once', () => {
    const ids = MODULES.map((module) => module.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every module at a path that exists', () => {
    for (const module of MODULES) {
      expect(exists(module.path), module.path).toBe(true);
    }
  });

  it('keeps every module inside its neighborhood', () => {
    for (const module of MODULES) {
      const neighborhood = neighborhoodById(module.neighborhood);

      expect(neighborhood, `${module.id} names neighborhood ${module.neighborhood}`).toBeDefined();

      if (neighborhood === undefined) continue;

      const [column, row] = module.cell;
      const [originColumn, originRow] = neighborhood.origin;
      const [width, depth] = neighborhood.size;

      expect(column, `${module.id} column`).toBeGreaterThanOrEqual(originColumn);
      expect(column, `${module.id} column`).toBeLessThan(originColumn + width);
      expect(row, `${module.id} row`).toBeGreaterThanOrEqual(originRow);
      expect(row, `${module.id} row`).toBeLessThan(originRow + depth);
    }
  });

  it('gives every module its own cell', () => {
    const cells = MODULES.map((module) => module.cell.join(','));

    expect(new Set(cells).size).toBe(cells.length);
  });

  it('uses each step caption once within a flow', () => {
    for (const flow of FLOWS) {
      const captions = flow.steps.map((step) => step.caption);

      expect(new Set(captions).size, flow.id).toBe(captions.length);
    }
  });

  it('routes every step between real modules', () => {
    for (const flow of FLOWS) {
      for (const step of flow.steps) {
        expect(moduleById(step.from), `${flow.id}: ${step.from}`).toBeDefined();
        expect(moduleById(step.to), `${flow.id}: ${step.to}`).toBeDefined();
      }
    }
  });

  it('links every step file to a path that exists', () => {
    for (const flow of FLOWS) {
      for (const step of flow.steps) {
        for (const file of step.files) {
          expect(exists(file), `${flow.id}: ${file}`).toBe(true);
        }
      }
    }
  });
});
