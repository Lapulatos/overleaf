import test from 'node:test'
import assert from 'node:assert/strict'
import {validateDiagnosis} from '../src/environment-diagnosis.mjs'
test('rejects shell-bearing packages and unsupported AI actions',()=>{
 const value={rootCause:'Missing package',explanation:'Install package',action:'compiler-repair',packages:['xkeyval']}
 assert.equal(validateDiagnosis(value).packages[0],'xkeyval')
 for(const packages of [['xkeyval; rm -rf /'],['--repository'],['foo/bar']])assert.throws(()=>validateDiagnosis({...value,packages}))
 assert.throws(()=>validateDiagnosis({...value,action:'run-host-shell'}))
})
