import assert from 'node:assert/strict'
import { test } from 'node:test'
import { groupPlugins, searchPluginGroups, matchScore } from '../../frontend/js/features/plugins/plugin-groups.ts'
const skill = (id, name, sourceUrl, command = name) => ({ id, name, sourceUrl, command, enabled: true })
const plugins = [
  skill('writer', 'Paper writer', 'https://github.com/mikubaka88/CCFA-Skills/tree/main/writer', 'ccf-paper-writer'),
  skill('visual', 'Visual composer', 'https://github.com/Mikubaka88/CCFA-Skills/blob/main/visual/SKILL.md', 'ccf-visual-composer'),
  skill('other', 'Other', 'https://github.com/other/CCFA-Skills'),
  { ...skill('builtin', 'Venues', ''), builtin: true },
]
test('groups repository subpaths and casing without merging different owners or builtins', () => {
  const groups = groupPlugins(plugins)
  assert.equal(groups.length, 3)
  assert.deepEqual(groups[0].plugins.map(p => p.id), ['writer', 'visual'])
  assert.equal(groups[0].url, 'https://github.com/mikubaka88/CCFA-Skills')
})
test('matches names, slash commands, subsequences and small typos, preserving repository ownership', () => {
  const groups = groupPlugins(plugins)
  for (const query of ['/ccf-paper-writer', 'ccfpw', 'Paper writer', 'ccf-paper-wrter']) {
    const matches = searchPluginGroups(groups, query)
    assert.equal(matches[0].id, groups[0].id)
    assert.deepEqual(matches[0].plugins.map(p => p.id), ['writer'])
  }
  assert.equal(searchPluginGroups(groups, 'CCFA-Skills')[0].plugins.length, 2)
  assert.equal(searchPluginGroups(groups, 'zzzznothing').length, 0)
  assert.ok(matchScore('writer', 'writer') > matchScore('writer-extra', 'writer'))
  assert.deepEqual(searchPluginGroups(groups, ' '), groups)
})
test('keeps malformed sources separate and does not mutate installed mappings', () => {
  const input = [skill('a', 'A', 'not a url'), skill('b', 'B', 'javascript:alert(1)')]
  const before = JSON.stringify(input)
  assert.equal(groupPlugins(input).length, 2)
  searchPluginGroups(groupPlugins(input), 'a')
  assert.equal(JSON.stringify(input), before)
})
