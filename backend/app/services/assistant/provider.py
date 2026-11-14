import abc
import json
from typing import Optional, Dict, Any
import httpx
from app.config import settings

class BaseAIProvider(abc.ABC):
    @abc.abstractmethod
    async def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        pass

class GeminiProvider(BaseAIProvider):
    def __init__(self, api_key: str, model: Optional[str] = None):
        self.api_key = api_key
        chosen_model = model or settings.AI_MODEL or "gemini-flash-lite-latest"
        if chosen_model in ("gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash", ""):
            chosen_model = "gemini-flash-lite-latest"
        self.model = chosen_model

    async def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        candidate_models = [self.model, "gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]
        candidate_models = list(dict.fromkeys(candidate_models))

        headers = {"Content-Type": "application/json"}
        contents = []
        if system_prompt:
            contents.append({"role": "user", "parts": [{"text": f"System Instructions: {system_prompt}"}]})
            contents.append({"role": "model", "parts": [{"text": "Understood. I will strictly follow these instructions."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.1
            }
        }

        last_error = None
        for m in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={self.api_key}"
            for attempt in range(2):
                try:
                    async with httpx.AsyncClient(timeout=25.0) as client:
                        resp = await client.post(url, headers=headers, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            try:
                                return data["candidates"][0]["content"]["parts"][0]["text"]
                            except (KeyError, IndexError):
                                raise RuntimeError("Malformed response from Gemini API")
                        if resp.status_code in (503, 429) and attempt < 1:
                            import asyncio
                            await asyncio.sleep(1.0)
                            continue
                        last_error = f"Gemini API error ({resp.status_code}) on {m}: {resp.text}"
                        if resp.status_code in (429, 404):
                            break
                except Exception as e:
                    last_error = f"Gemini connection error on {m}: {e}"
        raise RuntimeError(last_error or "Gemini API unavailable across all candidate models")

class OpenAIProvider(BaseAIProvider):
    def __init__(self, api_key: str, model: Optional[str] = None):
        self.api_key = api_key
        self.model = model or settings.AI_MODEL or "gpt-4o-mini"

    async def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.3
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI API error ({resp.status_code}): {resp.text}")
            data = resp.json()
            try:
                return data["choices"][0]["message"]["content"]
            except (KeyError, IndexError):
                raise RuntimeError("Malformed response from OpenAI API")

class OfflineRuleBasedProvider(BaseAIProvider):
    """
    Fallback provider when no AI API key is configured.
    Provides structured, pedagogically sound algorithmic guidance without requiring external cloud keys.
    """
    async def generate_text(self, prompt: str, system_prompt: str = "") -> str:
        lower = prompt.lower()
        if "practice" in lower or "generate" in lower or "solve" in lower:
            # Check if prompt contains extracted code blocks
            if "extracted code:" in lower:
                # Extract code from prompt
                parts = prompt.split("Extracted Code:")
                if len(parts) > 1:
                    code_block = parts[1].split("Provide clean")[0].split("Instructions:")[0].strip()
                    if code_block and len(code_block) > 10:
                        return code_block

            # Python / Machine Learning / Course Workspace
            if "python" in lower or "sklearn" in lower or "accuracy" in lower or ".py" in lower or "course" in lower:
                if "accuracy" in lower or "sklearn" in lower:
                    return (
                        "from sklearn.metrics import accuracy_score\n\n"
                        "# Actual labels (ground truth)\n"
                        "y_true = [1, 0, 1, 1, 0, 1, 0, 1, 0, 1]\n\n"
                        "# Predictions from our model\n"
                        "y_pred = [1, 0, 1, 0, 0, 1, 0, 1, 0, 1]\n\n"
                        "acc = accuracy_score(y_true, y_pred)\n"
                        "print(\"Accuracy:\", acc)\n"
                    )
                return (
                    "# AI-Assisted Solution\n"
                    "import sys\n\n"
                    "def solve():\n"
                    "    # Process data according to problem constraints\n"
                    "    pass\n\n"
                    "if __name__ == '__main__':\n"
                    "    solve()\n"
                )

            # C++ Competitive Programming Fallback
            return (
                "// AI-Assisted Practice Solution (Offline Reference Implementation)\n"
                "// NOTE: Permitted only for personal practice where AI assistance is allowed by applicable rules.\n"
                "#include <iostream>\n"
                "#include <vector>\n"
                "#include <algorithm>\n\n"
                "using namespace std;\n\n"
                "void solve() {\n"
                "    // Read test case data\n"
                "    long long n;\n"
                "    if (!(cin >> n)) return;\n"
                "    vector<long long> a(n);\n"
                "    for (int i = 0; i < n; i++) {\n"
                "        cin >> a[i];\n"
                "    }\n"
                "    // Example processing: sort and output\n"
                "    sort(a.begin(), a.end());\n"
                "    for (int i = 0; i < n; i++) {\n"
                "        cout << a[i] << (i + 1 == n ? \"\\n\" : \" \");\n"
                "    }\n"
                "}\n\n"
                "int main() {\n"
                "    ios_base::sync_with_stdio(false);\n"
                "    cin.tie(NULL);\n"
                "    int t = 1;\n"
                "    if (cin >> t) {\n"
                "        while (t--) {\n"
                "            solve();\n"
                "        }\n"
                "    }\n"
                "    return 0;\n"
                "}\n"
            )
        elif "explain" in lower:
            return (
                "### Problem Conceptual Explanation (Local Offline Engine)\n\n"
                "- **Core Objective**: Read each test case according to the problem format and process the elements sequentially.\n"
                "- **Key Invariant**: Pay careful attention to input scale and constraints (e.g., $10^5$ elements necessitate $O(N)$ or $O(N \\log N)$ algorithms).\n"
                "- **Edge Cases to Consider**:\n"
                "  1. Minimal input values ($N=0$ or $N=1$).\n"
                "  2. Maximum integer bounds (watch for 32-bit signed overflow; prefer `long long` in C++ for sums/products).\n"
                "  3. Boundary conditions such as duplicate elements or empty sequences."
            )
        elif "hint" in lower:
            if "level 1" in lower:
                return (
                    "### Hint 1: Intuition & Pattern Recognition\n"
                    "Consider whether this problem can be simplified by sorting the input or tracking frequencies with a hash map. "
                    "Ask yourself: do you need all past elements or just the current running minimum/maximum?"
                )
            elif "level 2" in lower:
                return (
                    "### Hint 2: Data Structure & Algorithmic Strategy\n"
                    "If the problem requires finding optimal pairings or subarray properties, a two-pointer approach, binary search over the answer, or a prefix sum array might reduce time complexity from $O(N^2)$ to $O(N)$ or $O(N \\log N)$."
                )
            else:
                return (
                    "### Hint 3: Implementation Guidance & Invariants\n"
                    "Structure your solution with fast I/O in C++:\n"
                    "```cpp\n"
                    "ios_base::sync_with_stdio(false);\n"
                    "cin.tie(NULL);\n"
                    "```\n"
                    "Maintain the invariant that your accumulator uses `long long` if values exceed $2 \\times 10^9$."
                )
        elif "approach" in lower:
            return (
                "### Algorithmic Approach & Complexity Analysis\n\n"
                "1. **Brute Force Baseline**:\n"
                "   - Compare all pairs or subsegments directly: $O(N^2)$ time, $O(1)$ extra space.\n"
                "   - Verdict: Feasible only if $N \\le 1000$. For $N \\ge 10^5$, this will Time Out (TLE).\n\n"
                "2. **Optimized Approach**:\n"
                "   - Use Sorting / Two Pointers or Hash Map: $O(N \\log N)$ or $O(N)$ time.\n"
                "   - Space Complexity: $O(N)$ or $O(1)$ auxiliary memory.\n"
                "   - Meets the standard 1.0s time limit comfortably (~$10^8$ operations per second)."
            )
        elif "review" in lower:
            return (
                "### Code Review & Diagnostic Assessment\n\n"
                "- **Integer Types**: Ensure numeric variables subject to large additions or products are declared as `long long` rather than standard 32-bit `int`.\n"
                "- **Fast I/O**: For competitive programming, unbind `cin` from `cout` to prevent I/O bottlenecks on large datasets.\n"
                "- **Loop Bounds**: Verify index ranges to avoid off-by-one errors and buffer overruns (`0` to `n-1`).\n"
                "- **Reset Between Test Cases**: Ensure global arrays or vectors are cleared on every test case loop."
            )
        elif "debug" in lower:
            return (
                "### Debugging & Error Diagnosis\n\n"
                "- **Compiler Diagnostics**: Check for missing semicolons, type mismatches, or undeclared identifiers.\n"
                "- **Common Runtime Traps**:\n"
                "  - `SIGSEGV`: Out-of-bounds array access or stack overflow.\n"
                "  - `SIGFPE`: Division by zero (check denominator inputs).\n"
                "  - `Time Limit Exceeded (TLE)`: Infinite loop or $O(N^2)$ algorithm where $N=10^5$."
            )
        elif "practice" in lower or "solution" in lower:
            return (
                "// AI-Assisted Practice Solution (Offline Reference Implementation)\n"
                "// NOTE: Permitted only for personal practice where AI assistance is allowed by applicable rules.\n"
                "#include <iostream>\n"
                "#include <vector>\n"
                "#include <algorithm>\n\n"
                "using namespace std;\n\n"
                "void solve() {\n"
                "    // Read test case data\n"
                "    long long n;\n"
                "    if (!(cin >> n)) return;\n"
                "    vector<long long> a(n);\n"
                "    for (int i = 0; i < n; i++) {\n"
                "        cin >> a[i];\n"
                "    }\n"
                "    // Example processing: sort and output\n"
                "    sort(a.begin(), a.end());\n"
                "    for (int i = 0; i < n; i++) {\n"
                "        cout << a[i] << (i + 1 == n ? \"\\n\" : \" \");\n"
                "    }\n"
                "}\n\n"
                "int main() {\n"
                "    ios_base::sync_with_stdio(false);\n"
                "    cin.tie(NULL);\n"
                "    int t = 1;\n"
                "    if (cin >> t) {\n"
                "        while (t--) {\n"
                "            solve();\n"
                "        }\n"
                "    }\n"
                "    return 0;\n"
                "}\n"
            )
        return "Educational assistant ready. Choose a specific action: Explain, Hint, Approach, Review, or Debug."

def get_ai_provider() -> BaseAIProvider:
    provider_name = (settings.AI_PROVIDER or "").lower().strip()
    api_key = settings.AI_API_KEY

    if api_key:
        if provider_name == "openai" or api_key.startswith("sk-"):
            return OpenAIProvider(api_key=api_key)
        else:
            # Default to Gemini for any Google key (AIza..., AQ..., etc.)
            return GeminiProvider(api_key=api_key)
    else:
        # Default fallback provider (works offline without external keys)
        return OfflineRuleBasedProvider()
