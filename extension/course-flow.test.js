const test = require('node:test');
const assert = require('node:assert/strict');
const flow = require('./course-flow.js').CodeChefCourseFlow;

const url = 'https://www.codechef.com/learn/course/example/problems/YTQAI83';
function page(body, { statement = true, editor = false, editorReady = editor, choices = [], controls = [] } = {}) {
  const buttonElements = controls.map((innerText) => ({ innerText }));
  return {
    body: { innerText: body },
    querySelector(selector) {
      if (selector.startsWith('.monaco-editor .view-lines')) return editorReady ? {} : null;
      if (selector.includes('.monaco-editor')) return editor ? {} : null;
      if (selector.includes('#problem-statement')) return statement ? {} : null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.startsWith('button')) return buttonElements;
      if (selector.includes("input[type='radio']")) return choices.map((value) => ({
        closest: () => ({ innerText: value, click() {} })
      }));
      return [];
    }
  };
}

test('same /problems/ route distinguishes theory, quiz and coding', () => {
  assert.equal(flow.classify(page('Classification - Intro'), url).type, 'theory');
  assert.equal(flow.classify(page('Which model?', { choices: ['A', 'B'] }), url).type, 'mcq');
  assert.equal(flow.classify(page('Write Python', { editor: true }), url).type, 'coding');
  assert.equal(flow.classify(page('Loading', { statement: false }), url).type, 'unknown');
  assert.equal(flow.classify(page('Logistic Regression - Worked Example\nGetting your container\nSetting up your editor'), url).type, 'loading');
  assert.equal(flow.classify(page('Setting up your editor', { editor: true, editorReady: false }), url).type, 'loading');
  assert.equal(flow.classify(page('Setting up your editor', { editor: true, editorReady: true }), url).type, 'coding');
});

test('coding requires actual solved banner and test rows', () => {
  const rows = 'Test results\nTest 1: DataFrame?\nTest 2: Feature?\nTest 3: Model?\nTest 4: Predictions?\n';
  assert.equal(flow.codeResult(page(rows)).status, 'pending');
  assert.equal(flow.codeResult(page('Test results\nRunning tests...\n' + rows)).status, 'pending');
  assert.equal(flow.codeResult(page(rows + '❌ Test 3 failed')).status, 'failed');
  assert.equal(flow.codeResult(page(rows + 'Test 4 failed\nCongratulations! You have solved the problem!!')).status, 'failed');
  const result = flow.codeResult(page(rows + 'Congratulations 🎉 You have solved the problem!!'));
  assert.equal(result.status, 'passed');
  assert.equal(result.count, 4);
  assert.equal(flow.codeResult(page('Congratulations! You have solved the problem!!')).status, 'pending');
});

test('coding accurately detects multiline solved banner with emoji and terminal noise from screenshot 2', () => {
  const screenshotBody = 'Test results\n' +
    '✓ Test 1: Have you created the DataFrame correctly using pd.DataFrame?\n' +
    '✓ Test 2: Have you selected the correct feature (X) and label (y)?\n' +
    '✓ Test 3: Have you created a LogisticRegression model instance?\n' +
    '✓ Test 4: Have you trained the model and generated predictions?\n\n' +
    'Congratulations 🎉\n' +
    'You have solved the problem!!\n\n' +
    'Move to next problem\n\n' +
    'SyntaxError: invalid syntax';
  const result = flow.codeResult(page(screenshotBody));
  assert.equal(result.status, 'passed');
  assert.equal(result.count, 4);
});

test('coding returns passed when all tests on screen have green ticks', () => {
  const allTicked = 'Test results\n' +
    '✓ Test 1: Completed sigmoid?\n' +
    '✓ Test 2: Filled np.array()?\n' +
    '✓ Test 3: Checked threshold?\n' +
    '✓ Test 4: Completed print statement?\n';
  const res = flow.codeResult(page(allTicked));
  assert.equal(res.status, 'passed');
  assert.equal(res.passed, 4);
  assert.equal(res.total, 4);
});

test('quiz does not advance on selection or failure and ignores question statements containing the word incorrect', () => {
  assert.equal(flow.mcqResult(page('Which one? Submit')), 'pending');
  assert.equal(flow.mcqResult(page('Which of the following statements about Logistic Regression is incorrect?\nSubmit')), 'pending');
  assert.equal(flow.mcqResult(page('Incorrect. Try again')), 'failed');
  assert.equal(flow.mcqResult(page('Correct!')), 'passed');
  assert.equal(flow.mcqResult(page('✓ Hooray, you did it!')), 'passed');
  assert.equal(flow.mcqResult(page('Incorrect. The correct answer is B')), 'failed');
});

test('MCQ option can be verified without a Submit button', async () => {
  let result = 'pending';
  const choice = { target: { click: () => { result = 'passed'; } } };
  const outcome = await flow.selectAndVerify(choice, {
    pageKey: () => '/problems/MCQ', result: () => result,
    submit: () => null, delay: async () => {},
    wait: () => { throw Error('click feedback should be used directly'); }
  });
  assert.equal(outcome, 'passed');
});

test('local course fallback chooses the classification option from the screenshot', () => {
  const scenario = `Scenario:\nProject A: Predicting whether a transaction is Fraud or Not Fraud.\nProject B: Predicting the amount of rainfall tomorrow (in mm).\nProject C: Predicting the weight of a newborn baby (in kg).\nQuestion: Which projects are Classification?`;
  const choices = ['Project B only', 'Project A and C', 'Project A only', 'All projects'];
  assert.equal(flow.localMCQAnswer(scenario, choices), 2);
  assert.equal(flow.localMCQAnswer(scenario.replace('Project A:', '• Project A:'), choices), 2);
  assert.equal(flow.localMCQAnswer('What is a decision tree?', choices), null);
});

test('coding can verify existing editor code if injection is unavailable', () => {
  const code = 'import pandas as pd\ndf = pd.DataFrame(data)\nmodel.fit(X, y)';
  assert.deepEqual(flow.codingAttempt({ status: 'ok', injected: false,
    data: { generated_code: 'new code' } }, code),
  { code, canHeal: false, testExisting: true, reason: 'Editor injection unavailable' });
  assert.deepEqual(flow.codingAttempt({ status: 'ok', injected: true,
    data: { generated_code: 'new code' } }, code),
  { code: 'new code', canHeal: true, testExisting: false, reason: '' });
  assert.equal(flow.codingAttempt(null, '').code, null);
  assert.equal(flow.codingAttempt(null, '', true).testExisting, true);
  assert.equal(flow.shouldTestExistingCode('import pandas as pd\n' + 'x = pd.DataFrame(data)\n'.repeat(5)), true);
  assert.equal(flow.shouldTestExistingCode('print(_____)'), false);
});
