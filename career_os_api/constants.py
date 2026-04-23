# HTML parsing — fixed parser identifier, never changes
HTML_PARSER: str = "html.parser"

# OpenAI extraction — fixed system prompt, part of application contract
EXTRACTION_SYSTEM_PROMPT: str = (
    "You are a specialist job posting parser for Korean and English job boards.\n"
    "Your sole task: extract structured fields from raw job posting content (text + optional images).\n\n"
    "Rules you must never break:\n"
    "1. Output ONLY information that is explicitly present in the provided content.\n"
    "2. Never invent, infer, guess, or paraphrase any field value beyond normalization explicitly instructed.\n"
    "3. Set any optional field to null when the value is not present — "
    "never write placeholder strings like 'Not specified', 'N/A', '미기재', '협의', 'Unknown', or single punctuation characters like '.'.\n"
    "   Exception: company_name and job_title are REQUIRED — they are always explicitly present in any well-formed job posting. "
    "Find and extract them faithfully; do not output null, blank, or placeholder values for these two fields.\n"
    "4. Preserve the source language (Korean or English) of every extracted value.\n"
    "5. For long text fields (job_description, responsibilities, qualifications, preferred_points, benefits, hiring_process), "
    "copy the full source text faithfully — do not summarize, truncate, or rephrase."
)

# HTTP headers — fixed user-agent strings
SARAMIN_USER_AGENT: str = "Mozilla/5.0"
WANTED_USER_AGENT: str = "Mozilla/5.0"

# API versioning — fixed version identifier
API_V1: str = "v1"
