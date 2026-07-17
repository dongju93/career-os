from main import career_os


def _operations() -> list[tuple[str, str, dict]]:
    schema = career_os.openapi()
    return [
        (path, method, operation)
        for path, path_item in schema["paths"].items()
        for method, operation in path_item.items()
        if method in {"get", "post", "put", "patch", "delete"}
    ]


def test_openapi_exposes_complete_api_metadata() -> None:
    schema = career_os.openapi()

    assert schema["info"]["title"] == "Career OS API"
    assert schema["info"]["summary"]
    assert schema["info"]["description"]
    assert schema["info"]["contact"]["url"] == ("https://github.com/dongju93/career-os")
    assert [tag["name"] for tag in schema["tags"]] == [
        "system",
        "auth",
        "job-postings",
        "job-search-groups",
        "profile",
        "chatkit",
        "agent",
    ]

    for path, method, operation in _operations():
        assert operation["summary"], f"missing summary: {method} {path}"
        assert operation["description"], f"missing description: {method} {path}"
        assert operation["operationId"], f"missing operationId: {method} {path}"
        assert operation["tags"], f"missing tags: {method} {path}"
        for status_code, response in operation["responses"].items():
            assert response["description"] != "Successful Response", (
                f"generic response description: {status_code} {method} {path}"
            )


def test_openapi_documents_problem_detail_errors_and_auth_scheme() -> None:
    schema = career_os.openapi()
    assert "BearerAuth" in schema["components"]["securitySchemes"]
    assert "ProblemDetail" in schema["components"]["schemas"]
    assert "ValidationProblemDetail" in schema["components"]["schemas"]

    for path, method, operation in _operations():
        if "401" in operation["responses"]:
            response = operation["responses"]["401"]
            assert response["content"]["application/json"]["schema"]["$ref"] == (
                "#/components/schemas/ProblemDetail"
            )
        if "422" in operation["responses"]:
            response = operation["responses"]["422"]
            assert response["content"]["application/json"]["schema"]["$ref"] == (
                "#/components/schemas/ValidationProblemDetail"
            ), f"wrong 422 schema: {method} {path}"


def test_openapi_documents_raw_protocol_request_bodies() -> None:
    schema = career_os.openapi()

    risc_body = schema["paths"]["/v1/auth/google/risc"]["post"]["requestBody"]
    assert "application/secevent+jwt" in risc_body["content"]
    assert risc_body["content"]["application/secevent+jwt"]["schema"]["format"] == (
        "jwt"
    )

    chatkit_body = schema["paths"]["/v1/chatkit"]["post"]["requestBody"]
    assert "application/json" in chatkit_body["content"]
    assert chatkit_body["content"]["application/json"]["schema"]["type"] == ("object")

    chatkit_response = schema["paths"]["/v1/chatkit"]["post"]["responses"]["200"]
    assert "text/event-stream" in chatkit_response["content"]
    assert "application/json" in chatkit_response["content"]
