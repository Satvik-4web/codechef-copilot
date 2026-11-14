"""
CodeChef Selectors Module
Contains resilient, semantic, and accessibility-first selectors for CodeChef problem pages,
practice lists, contest task tables, editor forms, and submission verdict elements.
"""

# Problem Title Selectors
TITLE_SELECTORS = [
    "h1[data-testid='problem-title']",
    "div[class*='problem-title'] h1",
    "h1[class*='Problem_title']",
    "div.problem-code-container h1",
    "div.breadcrumbs-container + div h1",
    "h1",
]

# Problem Statement Container Selectors
STATEMENT_SELECTORS = [
    "div[id='problem-statement']",
    "div[data-testid='problem-statement']",
    "div[class*='problem-statement']",
    "div[class*='Problem_statement']",
    "div.content-wrapper div.problem-statement",
    "div.markdown-renderer",
    "div[class*='statement']",
]

# Input & Output format section headers
INPUT_FORMAT_HEADERS = [
    "Input Format",
    "Input format",
    "Input:",
    "Input",
]

OUTPUT_FORMAT_HEADERS = [
    "Output Format",
    "Output format",
    "Output:",
    "Output",
]

# Constraints headers
CONSTRAINTS_HEADERS = [
    "Constraints",
    "Constraints:",
    "Subtasks",
]

# Sample test cases selectors
SAMPLE_BLOCK_SELECTORS = [
    "div[class*='sample-test']",
    "div[class*='SampleTest']",
    "div.sample-test-case",
    "pre",
    "code",
]

# Challenge / CAPTCHA markers
CHALLENGE_INDICATORS = [
    "cf-challenge",
    "cf-turnstile",
    "g-recaptcha",
    "h-captcha",
    "challenge-running",
    "Checking if the site connection is secure",
    "Verify you are human",
    "Cloudflare",
]

# Task List & Assignment Discovery Selectors
TASK_ROW_SELECTORS = [
    "table tbody tr",
    "div[class*='problem-row']",
    "div[class*='ProblemRow']",
    "div[class*='practice-card']",
    "div[class*='problem-card']",
    "li[class*='problem-item']",
]

# Task link pattern within a row or page
TASK_LINK_SELECTORS = [
    "a[href*='/problems/']",
    "a[href*='/practice/']",
    "a[href*='/submit/']",
]

# Submission Page Form & Editor Selectors
SUBMISSION_EDITOR_SELECTORS = [
    "div.monaco-editor",
    "textarea[class*='code-editor']",
    "textarea[name='code']",
    "div[role='textbox']",
]

# Submission Submit Button Selectors
SUBMIT_BUTTON_SELECTORS = [
    "button[data-testid='submit-code-button']",
    "button[class*='SubmitButton']",
    "button:has-text('Submit')",
    "button:has-text('Submit Code')",
    "input[type='submit']",
]

# Verdict Display Selectors
VERDICT_CONTAINER_SELECTORS = [
    "div[class*='submission-result']",
    "div[class*='SubmissionResult']",
    "div[class*='verdict']",
    "span[class*='verdict']",
    "div[class*='status-badge']",
    "div.status-banner",
]
