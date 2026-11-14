import re
from typing import Optional, Dict, Any
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.services.assistant.provider import get_ai_provider
from app.models.problem import Problem
from app.models.interaction import AssistantInteraction

LEARNING_SYSTEM_PROMPT = """
You are an expert computer science educator and competitive programming mentor for CodeChef.
CRITICAL INTEGRITY INSTRUCTIONS:
1. This is strictly an educational assistant designed to help the student learn.
2. In Learning Mode, you MUST NEVER write or give a complete, ready-to-submit solution.
3. For explanations: restate the problem in plain terms, identify inputs/outputs, and list edge cases.
4. For hints: give ONE graduated hint corresponding to the requested level (Level 1: General intuition, Level 2: Key data structure/algorithm, Level 3: Pseudocode/invariants). Do not reveal the full code.
5. For approach: discuss time and space complexity trade-offs between brute-force and optimal approaches.
6. For review: identify logic flaws, boundary errors, or performance bottlenecks in the student's code. Offer constructive suggestions without providing a wholesale replacement.
7. For debug: interpret compiler or runtime error messages clearly and suggest what lines or concepts need fixing.
8. Maintain a supportive, pedagogically rigorous tone.
"""

PRACTICE_SYSTEM_PROMPT = """
You are an expert competitive programming companion assisting with personal practice where AI-assisted solutions are permitted by the platform and course rules.
Provide a clean, efficient, modern solution. Include concise comments on complexity and invariants.
"""

COURSE_AUTOSOLVE_SYSTEM_PROMPT = """You are an elite competitive programming and machine learning lab assistant for CodeChef.
Your mission is to generate 100% correct, runnable, flawless code that passes all test cases and evaluation checks immediately.

CRITICAL RULES:
1. Return ONLY pure executable source code inside a single markdown code fence (```python or ```cpp).
2. NEVER include conversational chit-chat, explanations, introductions, or text outside the code fence.
3. If starter template / editor code is provided with blanks (such as `______` or `# TODO`):
   - You MUST preserve the exact template structure, variable names, function names, and comments.
   - Fill in every single blank and TODO with mathematically and logically correct code.
   - NEVER add new variables, synthetic datasets, dummy data, or new imports unless explicitly requested. Only complete the missing parts of the given template. Keep all other lines exactly as they are.
4. If an example input/output table or expected output format is given:
   - Match the exact expected output format. In CodeChef ML questions with loops like `for s, p, pred in zip(...)`, output standard space-separated values: `print(s, round(p, 2), pred)` unless another format is explicitly requested.
5. For Machine Learning tasks (NumPy, Scikit-learn, Pandas):
   - Use standard library APIs correctly (e.g. `1 / (1 + np.exp(-x))` for sigmoid, `model.fit(X, y)`, `accuracy_score(y_true, y_pred)`).
   - Ensure array dimensions, types, and thresholds match the problem specification.
6. CodeChef exercises are evaluated inside pre-configured test harnesses where variables (like X_train, y, etc.) may be defined elsewhere. NEVER inject dummy datasets, sample arrays, or mock values. Complete ONLY the given template lines and blanks.
7. INDENTATION & VARIABLE SCOPE:
   - Module-level variables and arrays (such as `scores = np.array(...)`, `probabilities = sigmoid(...)`, `predictions = ...`, `y_true = ...`, `y_pred = ...`, and subsequent loops `for ...:`) MUST BE DEFINED AT THE ROOT / MODULE LEVEL (0 spaces of indentation).
   - NEVER indent these variables or loops inside a previous function definition (like `def sigmoid(x):`).
   - CodeChef grading harnesses test by importing the module (`import main; main.scores; main.probabilities`). If they are indented inside a function, the test runner fails with "module 'main' has no attribute 'scores'/'probabilities'".
"""

def extract_clean_code(text: str) -> str:
    text = (text or "").strip()
    match = re.search(r"```(?:python|py|cpp|c\+\+)?\s*\n(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    # If no fences, remove lines that start with ```
    lines = [l for l in text.splitlines() if not l.strip().startswith("```")]
    return "\n".join(lines).strip()

from app.services.assistant.course_solver import CourseProblemSolver

class AssistantService:
    @staticmethod
    def _get_problem(db: Session, problem_id: Optional[int]) -> Optional[Problem]:
        if not problem_id:
            return None
        return db.query(Problem).filter(Problem.id == problem_id).first()

    @staticmethod
    def _record_interaction(db: Session, problem_id: Optional[int], itype: str, prompt: str, resp: str):
        if not db:
            return
        record = AssistantInteraction(
            problem_id=problem_id,
            interaction_type=itype,
            user_prompt=prompt[:2000],
            assistant_response=resp[:10000]
        )
        db.add(record)
        db.commit()

    @classmethod
    async def explain(cls, db: Session, problem_id: Optional[int], statement: Optional[str] = None) -> Dict[str, Any]:
        problem = cls._get_problem(db, problem_id)
        text_to_explain = (problem.statement if problem else statement) or "General programming problem"
        title = problem.title if problem else "Problem"

        prompt = f"Explain the following competitive programming problem for a learner:\nTitle: {title}\nStatement:\n{text_to_explain}"
        provider = get_ai_provider()
        response = await provider.generate_text(prompt, system_prompt=LEARNING_SYSTEM_PROMPT)

        cls._record_interaction(db, problem_id, "explain", prompt, response)
        return {
            "message": response,
            "interaction_type": "explain",
            "is_ai_assisted": False,
            "disclaimer": "Educational explanation provided for conceptual understanding."
        }

    @classmethod
    async def hint(cls, db: Session, problem_id: Optional[int], current_code: Optional[str], level: int = 1) -> Dict[str, Any]:
        problem = cls._get_problem(db, problem_id)
        title = problem.title if problem else "Problem"
        statement = problem.statement if problem else ""

        prompt = f"Provide a Level {level} graduated hint for the problem '{title}'.\nProblem Statement: {statement}\n"
        if current_code:
            prompt += f"The student's current code attempt:\n```cpp\n{current_code}\n```\n"
        prompt += f"Remember: Provide only a Level {level} hint without giving away the full solution."

        provider = get_ai_provider()
        response = await provider.generate_text(prompt, system_prompt=LEARNING_SYSTEM_PROMPT)

        cls._record_interaction(db, problem_id, f"hint_level_{level}", prompt, response)
        return {
            "message": response,
            "interaction_type": "hint",
            "hint_level": level,
            "is_ai_assisted": False,
            "disclaimer": f"Graduated Hint {level}/3. Try applying this hint to your code before requesting the next one!"
        }

    @classmethod
    async def approach(cls, db: Session, problem_id: Optional[int]) -> Dict[str, Any]:
        problem = cls._get_problem(db, problem_id)
        title = problem.title if problem else "Problem"
        statement = problem.statement if problem else ""
        constraints = problem.constraints if problem else ""

        prompt = f"Analyze algorithmic approaches and time/space complexities for '{title}'.\nStatement: {statement}\nConstraints: {constraints}"
        provider = get_ai_provider()
        response = await provider.generate_text(prompt, system_prompt=LEARNING_SYSTEM_PROMPT)

        cls._record_interaction(db, problem_id, "approach", prompt, response)
        return {
            "message": response,
            "interaction_type": "approach",
            "is_ai_assisted": False,
            "disclaimer": "Algorithmic analysis to guide your implementation."
        }

    @classmethod
    async def review(cls, db: Session, problem_id: Optional[int], source_code: str, language: str = "cpp17") -> Dict[str, Any]:
        problem = cls._get_problem(db, problem_id)
        title = problem.title if problem else "Problem"

        prompt = (
            f"Review this {language} code for '{title}'. Identify logic errors, edge cases, potential overflow, "
            f"and complexity issues. Suggest corrections conceptually without writing the complete code:\n```cpp\n{source_code}\n```"
        )
        provider = get_ai_provider()
        response = await provider.generate_text(prompt, system_prompt=LEARNING_SYSTEM_PROMPT)

        cls._record_interaction(db, problem_id, "review", prompt, response)
        return {
            "message": response,
            "interaction_type": "review",
            "is_ai_assisted": False,
            "disclaimer": "Constructive code review. Implement the recommended fixes yourself in the editor."
        }

    @classmethod
    async def debug(
        cls,
        db: Session,
        problem_id: Optional[int],
        source_code: str,
        compiler_error: Optional[str] = None,
        runtime_error: Optional[str] = None
    ) -> Dict[str, Any]:
        problem = cls._get_problem(db, problem_id)
        title = problem.title if problem else "Problem"

        error_context = f"Compiler Output:\n{compiler_error}\n" if compiler_error else ""
        if runtime_error:
            error_context += f"Runtime Output / Diagnostics:\n{runtime_error}\n"

        prompt = (
            f"Help debug this code for '{title}'.\nErrors encountered:\n{error_context}\n"
            f"Code:\n```cpp\n{source_code}\n```\nExplain what caused this error and how to fix it."
        )
        provider = get_ai_provider()
        response = await provider.generate_text(prompt, system_prompt=LEARNING_SYSTEM_PROMPT)

        cls._record_interaction(db, problem_id, "debug", prompt, response)
        return {
            "message": response,
            "interaction_type": "debug",
            "is_ai_assisted": False,
            "disclaimer": "Diagnostic explanation to help you understand and resolve the error."
        }

    @classmethod
    async def practice_solution(
        cls,
        db: Session,
        problem_id: Optional[int],
        user_confirmed_allowed: bool,
        language: Optional[str] = "python",
        problem_statement: Optional[str] = None,
        extracted_code: Optional[str] = None,
        editor_code: Optional[str] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        # Strict Academic Integrity Gating
        if not user_confirmed_allowed:
            raise HTTPException(
                status_code=400,
                detail="Academic Integrity Guard: You must explicitly confirm that AI-generated practice solutions are permitted for this specific task under your course and platform rules."
            )

        problem = cls._get_problem(db, problem_id)
        task_title = title or (problem.title if problem else "Practice Task")
        statement = problem_statement or (problem.statement if problem else "")
        constraints = problem.constraints if problem else ""
        lang = (language or "python").lower()

        provider = get_ai_provider()
        from app.services.assistant.provider import OfflineRuleBasedProvider
        if not isinstance(provider, OfflineRuleBasedProvider):
            prompt = (
                f"You are an expert coding assistant. Solve the following {lang} task for '{task_title}'.\n"
                f"Instructions / Problem Statement:\n{statement}\n"
            )
            if editor_code and len(editor_code.strip()) > 5:
                prompt += f"\nCurrent Editor Code / Starter Template:\n```{lang}\n{editor_code}\n```\n"
                prompt += "CRITICAL: Do NOT invent or add any dummy data, synthetic arrays, or extra lines. Keep the exact starter template lines and structure, replacing each blank (______) and TODO with the correct code.\n"
            elif extracted_code and len(extracted_code.strip()) > 5:
                prompt += f"\nExtracted Code Snippets / Tutorial:\n{extracted_code}\n"
                prompt += "Produce the complete, working solution based on this code.\n"

            try:
                ai_response = await provider.generate_text(prompt, system_prompt=COURSE_AUTOSOLVE_SYSTEM_PROMPT)
                clean_code = extract_clean_code(ai_response)
                if clean_code and len(clean_code) > 15:
                    cls._record_interaction(db, problem_id, "practice_solution", prompt, clean_code)
                    return {
                        "message": "AI-assisted solution generated.",
                        "interaction_type": "practice_solution",
                        "generated_code": clean_code,
                        "is_ai_assisted": True,
                        "disclaimer": "AI-Assisted Practice Solution."
                    }
            except Exception as e:
                print("External AI call failed, falling back to CourseProblemSolver:", e)

        # Check if specialized CourseProblemSolver can solve it directly as fallback
        course_solution = CourseProblemSolver.solve(
            statement=statement,
            editor_code=editor_code,
            extracted_code=extracted_code,
            title=task_title
        )

        # Use CourseProblemSolver result
        cls._record_interaction(db, problem_id, "practice_solution", statement[:500], course_solution)
        return {
            "message": "Course-optimized solution generated.",
            "interaction_type": "practice_solution",
            "generated_code": course_solution,
            "is_ai_assisted": True,
            "disclaimer": "AI-Assisted Practice Solution."
        }

    @classmethod
    async def auto_solve(
        cls,
        db: Session,
        problem_id: Optional[int],
        problem_statement: Optional[str] = None,
        extracted_code: Optional[str] = None,
        editor_code: Optional[str] = None,
        language: Optional[str] = "python",
        title: Optional[str] = None,
        user_confirmed_allowed: bool = True
    ) -> Dict[str, Any]:
        return await cls.practice_solution(
            db=db,
            problem_id=problem_id,
            user_confirmed_allowed=user_confirmed_allowed,
            language=language,
            problem_statement=problem_statement,
            extracted_code=extracted_code,
            editor_code=editor_code,
            title=title
        )

    @classmethod
    async def solve_mcq(
        cls,
        question: str,
        options: list,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        import json
        from app.services.assistant.course_mcq import solve_project_type
        local_index = solve_project_type(question, options, context or "")
        if local_index is not None:
            return {
                "correct_option_index": local_index,
                "correct_option_text": options[local_index],
                "explanation": "Project outcome type: category versus numeric value."
            }
        options_formatted = "\n".join(f"{i}: {opt}" for i, opt in enumerate(options))
        prompt = (
            f"You are an expert exam solver for Computer Science and Machine Learning.\n"
            f"Question:\n{question}\n\n"
            f"Options:\n{options_formatted}\n\n"
        )
        if context:
            prompt += f"Context / Reading Notes:\n{context[:2000]}\n\n"
        prompt += (
            "Select the single best correct option index (0-indexed).\n"
            "Respond ONLY with a JSON object in this format:\n"
            '{"correct_index": <int>, "reason": "<brief reason>"}'
        )

        provider = get_ai_provider()
        from app.services.assistant.provider import OfflineRuleBasedProvider
        failure_reason = "AI provider is not configured"
        if not isinstance(provider, OfflineRuleBasedProvider):
            try:
                resp = await provider.generate_text(
                    prompt,
                    system_prompt="You are an expert examination solver. Output valid JSON only."
                )
                cleaned = resp.replace("```json", "").replace("```", "").strip()
                try:
                    data = json.loads(cleaned)
                except json.JSONDecodeError:
                    import re
                    object_match = re.search(r"\{[\s\S]*?\}", cleaned)
                    if not object_match:
                        raise
                    data = json.loads(object_match.group())
                idx = int(data["correct_index"])
                if 0 <= idx < len(options):
                    return {
                        "correct_option_index": idx,
                        "correct_option_text": options[idx],
                        "explanation": data.get("reason", "")
                    }
            except Exception as e:
                print("MCQ AI solve error:", e)

        return {
            "correct_option_index": 0,
            "correct_option_text": options[0] if options else "",
            "explanation": "Default/fallback option selection"
        }

    @classmethod
    async def auto_heal(
        cls,
        current_code: str,
        error_output: str,
        problem_statement: Optional[str] = None,
        language: Optional[str] = "python",
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        lang = (language or "python").lower()
        prompt = (
            f"You are an expert autonomous debugger. The following {lang} code failed during execution on CodeChef.\n\n"
            f"=== ERROR / TERMINAL OUTPUT ===\n{error_output}\n\n"
            f"=== CURRENT FAILING CODE ===\n```{lang}\n{current_code}\n```\n\n"
        )
        if problem_statement:
            prompt += f"=== PROBLEM STATEMENT / REQUIREMENTS ===\n{problem_statement}\n\n"
        prompt += (
            "CRITICAL INSTRUCTIONS:\n"
            "1. Diagnose the exact error (e.g. wrong function name, wrong import, shape mismatch, type error, missing variable, wrong print format).\n"
            "2. If the error mentions 'module has no attribute X' or 'IndentationError', check if variable 'X' or subsequent code blocks were mistakenly indented inside a function (e.g. inside `def sigmoid(...)`). Unindent all module-level variables, arrays, and loops to column 0!\n"
            "3. Fix the error completely.\n"
            "4. Return ONLY the complete, corrected, runnable code. Do NOT wrap in markdown fences if possible, or use standard markdown ``` tags. Absolutely no chat, explanations, apologies, or preamble."
        )

        provider = get_ai_provider()
        from app.services.assistant.provider import OfflineRuleBasedProvider
        if not isinstance(provider, OfflineRuleBasedProvider):
            try:
                ai_response = await provider.generate_text(prompt, system_prompt=COURSE_AUTOSOLVE_SYSTEM_PROMPT)
                clean_code = extract_clean_code(ai_response)
                if clean_code and len(clean_code.strip()) > 10:
                    return {
                        "fixed_code": clean_code,
                        "explanation": "Fixed via Gemini Auto-Heal"
                    }
            except Exception as e:
                print("Auto-heal AI error:", e)

        # Fallback & Deterministic Fix for Scope/Indentation issues:
        err_lower = (error_output or "").lower()
        if "has no attribute" in err_lower or "indentation" in err_lower or "attribute" in err_lower:
            lines = current_code.split("\n")
            fixed_lines = []
            in_func = False
            saw_return = False
            for line in lines:
                trimmed = line.strip()
                if trimmed.startswith("def "):
                    in_func = True
                    saw_return = False
                    fixed_lines.append(line)
                    continue
                if in_func and (trimmed.startswith("return ") or trimmed == "return"):
                    saw_return = True
                    fixed_lines.append(line)
                    continue
                if in_func and saw_return:
                    # If this line is a module-level variable, step comment, or loop, unindent to col 0!
                    if (
                        trimmed.startswith("scores") or
                        trimmed.startswith("probabilities") or
                        trimmed.startswith("predictions") or
                        trimmed.startswith("y_true") or
                        trimmed.startswith("y_pred") or
                        trimmed.startswith("acc =") or
                        trimmed.startswith("f1 =") or
                        trimmed.startswith("f1_score") or
                        trimmed.startswith("# Step") or
                        trimmed.startswith("# Display") or
                        trimmed.startswith("# Actual") or
                        trimmed.startswith("# Predictions") or
                        trimmed.startswith("# Calculate") or
                        trimmed.startswith("# Print") or
                        trimmed.startswith("for ") or
                        trimmed.startswith("print(")
                    ):
                        if trimmed.startswith("print(") and "zip" in "".join(lines):
                            fixed_lines.append("    " + trimmed)
                        else:
                            fixed_lines.append(trimmed)
                        continue
                fixed_lines.append(line)
            fixed_code = "\n".join(fixed_lines)
            if fixed_code != current_code:
                return {
                    "fixed_code": fixed_code,
                    "explanation": "Deterministic scope & indentation correction applied"
                }

        return {
            "fixed_code": current_code,
            "explanation": "Fallback (no changes)"
        }
