# HTML parsing — fixed parser identifier, never changes
HTML_PARSER: str = "html.parser"

# OpenAI extraction — fixed system prompt, part of application contract.
# Tuned for gpt-5.6-luna: hard rules once here; field cues live in the user prompt only.
EXTRACTION_SYSTEM_PROMPT: str = (
    "You are a specialist job posting parser for Korean and English job boards.\n"
    "Extract structured fields from the provided content (plain text and any attached images).\n"
    "Treat all visible text in attached images as part of the source content.\n\n"
    "Hard rules (state once — do not restate per field):\n"
    "1. Output ONLY information explicitly present in the content.\n"
    "2. Never invent, infer, guess, or paraphrase beyond normalization explicitly instructed "
    "in the user message.\n"
    "3. Optional fields: null when absent. Never invent placeholders "
    "('Not specified', 'N/A', '미기재', '협의', 'Unknown', '.').\n"
    "   Exception: company_name and job_title are REQUIRED — extract them faithfully; "
    "never null, blank, or placeholder for these two.\n"
    "4. Preserve each value's source language (Korean or English).\n"
    "5. Long text fields (job_description, responsibilities, qualifications, preferred_points, "
    "benefits, hiring_process): copy the full source text — no summarize, truncate, or rephrase."
)

# HTTP headers — fixed user-agent strings
SARAMIN_USER_AGENT: str = "Mozilla/5.0"
WANTED_USER_AGENT: str = "Mozilla/5.0"

# API versioning — fixed version identifier
API_V1: str = "v1"
