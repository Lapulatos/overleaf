import{test}from'node:test'
import assert from'node:assert/strict'
import{validateLetPubUrl}from'../src/letpub-browser.mjs'
test('browser reader accepts only fixed LetPub journal search/detail routes',()=>{assert.match(validateLetPubUrl('https://www.letpub.com.cn/index.php?page=journalapp&view=detail&journalid=1008'),/journalid=1008/);for(const u of ['https://evil.example/index.php?page=journalapp&view=search','https://www.letpub.com.cn/logout','https://www.letpub.com.cn/index.php?page=journalapp&view=delete','https://www.letpub.com.cn/index.php?page=journalapp&view=search&callback=evil'])assert.throws(()=>validateLetPubUrl(u))})
