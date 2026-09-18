# SAATHI Normalized Input Contract

This contract defines the structure of data emitted by the interaction layer (Dev A) to downstream systems (Person B and Person C). 

## Purpose
The purpose of this contract is to decouple the interaction layer (which handles varied inputs like voice, SMS, and text via Twilio, Whisper, etc.) from downstream business logic and NLP processing. This allows downstream consumers to build against a stable, predictable, normalized schema.

## Fields
- `user_id`: Unique Saathi user identifier.
- `channel`: Channel through which the user input arrived. (Current MVP contract value: `"whatsapp"`)
- `input_type`: Original input type: `"text"`, `"voice"`, or `"sms"`.
- `raw_text`: Original user text or speech transcript before normalization. Never discard it.
- `normalized_text`: Cleaned, consistent representation for downstream processing.
- `parsed_transaction`: Structured transaction if one can be extracted. May be null when the input is ambiguous, incomplete, or non-transactional.
- `confidence`: 0.0 to 1.0 confidence in the parsed interaction/transaction. Low confidence must not be silently treated as fact.

## Consumer Assumptions
### What downstream developers may assume:
- All top-level fields defined in the schema will be present.
- `amount` in `parsed_transaction` will always be a number >= 0.
- `confidence` is strictly a floating-point number between 0.0 and 1.0 inclusive.

### What downstream developers must NOT assume:
- Do not assume `parsed_transaction` is always populated; it may be `null`.
- Do not assume the interaction represents a financial transaction. It may be conversational.
- Do not assume unknown fields will be present (additional fields are rejected).
