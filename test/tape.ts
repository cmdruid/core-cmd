import tape from 'tape'

import base_test from './src/base.test.js'

tape('Core Command test suite.', async t => {
  base_test(t)
})
