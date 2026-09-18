"""Replies must be deliverable over WhatsApp: plain text (no markdown) and under Twilio's 1,600-char limit.

Layer 1: the system prompts ask the model for plain text under ~1,400 chars.
Layer 2: sanitize_reply() is a deterministic safety net (strip markdown, cut at a sentence boundary).
The last test generates a guidance reply for a real question with the real Groq LLM (skipped if no GROQ_API_KEY).
"""
import os
import re
from types import SimpleNamespace

import pytest

from app.api import main as api_main  # loads person_c/.env (GROQ_API_KEY) before we read the environment
from app.contracts.input import BusinessData, BusinessLastEntry, GoalData, GuidanceRequest
from app.education.llm import GroqLLM
from app.formatting.plain_text import (
    MAX_REPLY_CHARS, PLAIN_TEXT_RULES, TARGET_REPLY_CHARS, fit_to_limit, sanitize_reply, to_plain_text,
)
from app.personalization.service import PersonalizationService
from app.rag.models import RetrievedContext

MARKDOWN_PATTERNS = {
    "header": r"(?m)^\s{0,3}#{1,6}\s",
    "bold": r"\*\*",
    "underscore-bold": r"__\w",
    "backtick": r"`",
    "table row": r"(?m)^\s*\|",
    "pipe cells": r"\|[^|\n]+\|",
    "horizontal rule": r"(?m)^\s*([-*_])(\s*\1){2,}\s*$",
    "link": r"\[[^\]]+\]\([^)]+\)",
    "block quote": r"(?m)^\s*>",
}


def markdown_found(text):
    return [name for name, pat in MARKDOWN_PATTERNS.items() if re.search(pat, text)]


LONG_MARKDOWN_REPLY = (
    "### Quick snapshot of your situation\n\n"
    "| Item | Amount |\n|------|--------|\n| **Cash** | 2,000 |\n| **Bank** | 5,000 |\n\n---\n\n"
    "## 1. Make the goal **SMART**\n> Save Rs. 12,000 for your daughter's education.\n\n"
    + "You can put aside a little every month and watch the education pot grow steadily. " * 40
    + "\n\nSee [the SEBI page](https://investor.sebi.gov.in) for `more` details."
)


# ---- to_plain_text ----------------------------------------------------------------------------------------

def test_markdown_is_stripped_but_the_words_and_numbers_survive():
    out = to_plain_text(LONG_MARKDOWN_REPLY)
    assert markdown_found(out) == []
    assert "Quick snapshot of your situation" in out
    assert "Cash: 2,000" in out and "Bank: 5,000" in out          # table rows become "label: value"
    assert "Item" not in out.split("Cash")[0].splitlines()[-1]    # header row dropped
    assert "the SEBI page (https://investor.sebi.gov.in)" in out  # link keeps its text and url
    assert "more details" in out


def test_plain_text_and_snake_case_and_math_are_left_alone():
    text = "Save 2 * 3 = 6 rupees using my_pot_name, then relax."
    assert to_plain_text(text) == text


def test_bullets_and_numbered_lists_stay_readable():
    out = to_plain_text("* first\n+ second\n- third\n1. one\n2. two")
    assert out == "- first\n- second\n- third\n1. one\n2. two"


# ---- fit_to_limit -----------------------------------------------------------------------------------------

def test_short_text_is_untouched():
    assert fit_to_limit("Short and sweet.") == "Short and sweet."


def test_long_text_is_cut_at_a_sentence_boundary_never_mid_word():
    text = "Save a little each month. " * 200
    out = fit_to_limit(text, 1500)
    assert len(out) <= 1500 and out.endswith("month.")
    assert out == ("Save a little each month. " * 200)[: len(out)]  # a clean prefix, nothing mangled


@pytest.mark.parametrize("closing", [".", "!", "?"])
def test_every_sentence_terminator_counts(closing):
    out = fit_to_limit(("Put money aside now" + closing + " ") * 200, 1500)
    assert out.endswith("now" + closing) and len(out) <= 1500


def test_abbreviations_and_list_numbers_are_not_treated_as_sentence_ends():
    text = "You should keep Rs. 500 aside every single month for the education goal " + "and keep going " * 200
    # the only real sentence end is far past the limit, so the cut must not stop after "Rs." (an unfinished sentence)
    out = fit_to_limit(text, 300)
    assert not out.endswith("Rs.")
    assert len(out) <= 301


def test_falls_back_to_last_line_then_last_word_and_never_exceeds_limit():
    assert fit_to_limit("first line without a period\n" + "x" * 50 + " word " * 500, 200).startswith("first line")
    out = fit_to_limit("word " * 500, 100)
    assert len(out) <= 101 and out.endswith("…") and not out.rstrip("…").endswith("wor")
    assert len(fit_to_limit("y" * 5000, 100)) <= 101


def test_sanitize_reply_end_to_end_on_a_long_markdown_reply():
    assert len(LONG_MARKDOWN_REPLY) > MAX_REPLY_CHARS
    out = sanitize_reply(LONG_MARKDOWN_REPLY)
    assert markdown_found(out) == []
    assert len(out) <= MAX_REPLY_CHARS < 1600
    assert out.rstrip()[-1] in ".!?"


def test_sanitize_reply_handles_empty_input():
    assert sanitize_reply("") == "" and sanitize_reply(None) == ""


# ---- GroqLLM: prompts + safety net, with a fake client that overruns ----------------------------------------

class FakeGroq:
    """Stands in for groq.Groq: records the prompts and returns a huge markdown reply like a misbehaving model."""
    def __init__(self):
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs["messages"])
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=LONG_MARKDOWN_REPLY))])


def _fake_llm():
    llm = GroqLLM.__new__(GroqLLM)
    llm.client, llm.model = FakeGroq(), "fake"
    return llm


CTX = [RetrievedContext(text="Save regularly.", metadata={"source_name": "SEBI", "source_class": "SEBI"}, score=1.0)]
RESULT = {"scenario": "savings_goal_feasibility", "target": 20000, "saved": 8000, "gap": 12000, "classification": "SUSPICIOUS",
          "signals": [], "recommended_action": "Do not click", "uncertainty": "Be careful"}


@pytest.mark.parametrize("call", [
    lambda l: l.generate_response("What is saving?", CTX),
    lambda l: l.generate_personalized_response("How do I save?", CTX, {"cash": 1}, {"gap": 12000}, "TIER 3: be detailed"),
    lambda l: l.generate_simulator_response(RESULT, "TIER 3: be detailed", "How long?", CTX),
    lambda l: l.generate_safety_response(RESULT, "Your KYC will expire, click to verify", "TIER 3: be detailed"),
], ids=["education", "personalized", "simulator", "safety"])
def test_every_generation_path_asks_for_plain_text_and_enforces_it(call):
    llm = _fake_llm()
    out = call(llm)
    system_prompt = llm.client.calls[0][0]["content"]
    assert PLAIN_TEXT_RULES.strip() in system_prompt
    assert system_prompt.rstrip().endswith("Always finish your last sentence.")  # rules come last so they win over TIER 3
    assert markdown_found(out) == []
    assert len(out) <= MAX_REPLY_CHARS < 1600 and out.rstrip()[-1] in ".!?"


def test_prompt_states_the_length_budget():
    assert f"{TARGET_REPLY_CHARS:,}" in PLAIN_TEXT_RULES and "plain text" in PLAIN_TEXT_RULES.lower()


# ---- real question, real LLM ---------------------------------------------------------------------------------

@pytest.mark.skipif(not os.environ.get("GROQ_API_KEY"), reason="GROQ_API_KEY not set")
def test_real_groq_guidance_reply_is_plain_text_and_under_1600_chars():
    llm = GroqLLM(api_key=os.environ["GROQ_API_KEY"], model=os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b"))
    service = PersonalizationService(api_main._retriever, llm)
    request = GuidanceRequest(
        cash=2000, bank=5000, shg=2500, chit_committed=4000, post_office=5000,
        business=BusinessData(activity="pickle sales + tailoring", last_entry=BusinessLastEntry(revenue=1000, cost=600, profit=400)),
        goal=GoalData(name="Education", target=20000, saved=8000),
        question="how can I reach my daughter's education goal faster?",
        request_mode="personalized", literacy_tier=3,  # tier 3 asks for "greater detail": the hardest case for brevity
    )
    reply = service.get_guidance(request).response_text
    print("\n--- real Groq reply (%d chars) ---\n%s" % (len(reply), reply))
    assert reply.strip(), "empty reply (LLM call failed?)"
    assert markdown_found(reply) == [], markdown_found(reply)
    assert len(reply) < 1600
    assert reply.rstrip()[-1] in ".!?", "reply ends mid-sentence"
