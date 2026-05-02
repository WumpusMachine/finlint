import sys
import os
import time
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'evals'))
from runner import SYSTEM_PROMPT, FEW_SHOT_EXAMPLES
from baseline_runner import BASELINE_SYSTEM

from flask import Flask, request, jsonify, send_from_directory
import anthropic

app = Flask(__name__, static_folder='.')

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1000

api_key = os.environ.get("ANTHROPIC_API_KEY")
if not api_key:
    print("ERROR: ANTHROPIC_API_KEY environment variable not set.")
    sys.exit(1)

client = anthropic.Anthropic(api_key=api_key)


def strip_fences(text):
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("{"):
                return part
    return text


def extract_json(text):
    start = text.find("{")
    end = text.rfind("}") + 1
    if start != -1 and end > start:
        return text[start:end]
    return text


@app.route("/")
def index():
    return send_from_directory('.', 'index.html')


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(force=True)
    code = data.get("code", "").strip()
    mode = data.get("mode", "full")

    if not code:
        return jsonify({"error": "No code provided"}), 400

    if mode == "baseline":
        system = BASELINE_SYSTEM
        user_message = f"Review this code:\n{code}"
    else:
        system = SYSTEM_PROMPT
        user_message = f"{FEW_SHOT_EXAMPLES}\n\nNow review this code:\n{code}"

    start = time.time()
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = response.content[0].text
        elapsed = round((time.time() - start) * 1000)

        cleaned = strip_fences(raw)
        cleaned = extract_json(cleaned)
        parsed = json.loads(cleaned)

        return jsonify({
            "result": parsed,
            "mode": mode,
            "model": MODEL,
            "elapsed_ms": elapsed,
        })

    except json.JSONDecodeError:
        return jsonify({
            "error": "Model returned non-JSON response",
            "raw": raw,
            "mode": mode,
            "model": MODEL,
            "elapsed_ms": round((time.time() - start) * 1000),
        }), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("Starting Finlint server on http://localhost:3000")
    app.run(host="0.0.0.0", port=3000, debug=False)
