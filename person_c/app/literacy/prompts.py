def get_literacy_instructions(tier: int) -> str:
    if tier == 1:
        return (
            "INSTRUCTIONS FOR TIER 1 LITERACY:\n"
            "- Use very simple vocabulary.\n"
            "- Write in short, direct sentences.\n"
            "- Avoid complex financial terminology entirely.\n"
            "- Explain any basic concepts directly and clearly.\n"
            "- Keep the response concise and accessible for a user with limited financial familiarity."
        )
    elif tier == 2:
        return (
            "INSTRUCTIONS FOR TIER 2 LITERACY:\n"
            "- Use moderately simple language.\n"
            "- Basic financial terms may be used, but you must explain unfamiliar terms.\n"
            "- Keep response length moderate, balancing clarity with necessary detail."
        )
    else: # tier == 3 or unknown
        return (
            "INSTRUCTIONS FOR TIER 3 LITERACY:\n"
            "- Provide a more detailed explanation.\n"
            "- Normal financial terminology is acceptable.\n"
            "- Provide complete reasoning and greater detail where useful for comprehensive understanding."
        )
