from app.core.rate_limit import rate_limit_key


class FakeRequest:
    def __init__(self, headers, client_host="1.2.3.4"):
        self.headers = headers
        self.client = type("C", (), {"host": client_host})()


def test_different_api_keys_get_different_buckets():
    key_a = rate_limit_key(FakeRequest({"X-API-Key": "sk_live_AAAA"}))
    key_b = rate_limit_key(FakeRequest({"X-API-Key": "sk_live_BBBB"}))
    assert key_a != key_b
    assert key_a == "apikey:sk_live_AAAA"


def test_no_api_key_falls_back_to_ip():
    key = rate_limit_key(FakeRequest({}))
    assert key == "1.2.3.4"


def test_same_api_key_from_different_ip_shares_a_bucket():
    key1 = rate_limit_key(FakeRequest({"X-API-Key": "sk_live_AAAA"}, client_host="1.1.1.1"))
    key2 = rate_limit_key(FakeRequest({"X-API-Key": "sk_live_AAAA"}, client_host="9.9.9.9"))
    assert key1 == key2