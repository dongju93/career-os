# HTML parsing — fixed parser identifier, never changes
HTML_PARSER: str = "html.parser"

# OpenAI extraction — fixed system prompt, part of application contract
EXTRACTION_SYSTEM_PROMPT: str = (
    "You are a precise job posting data extractor. "
    "Output ONLY information that is explicitly present in the provided content. "
    "Never invent, infer, or hallucinate any field value. "
    "Set any field to null when the value is not explicitly stated."
)

# HTTP headers — fixed user-agent strings
SARAMIN_USER_AGENT: str = "Mozilla/5.0"
WANTED_USER_AGENT: str = "Mozilla/5.0"

# API versioning — fixed version identifier
API_V1: str = "v1"
