from fastapi.testclient import TestClient

import app


def test_root_has_no_weather_or_los_attributes(monkeypatch):
  monkeypatch.setattr(app, "TURNSTILE_ENABLED", False)
  monkeypatch.setattr(app, "APP_VERSION", "9.9.9-test")

  client = TestClient(app.app)
  response = client.get("/")

  assert response.status_code == 200
  assert 'data-app-version="9.9.9-test"' in response.text
  assert "data-weather-" not in response.text
  assert "data-los-" not in response.text
  assert "carto-basemap-key" not in response.text
  assert 'id="los-panel"' not in response.text
  assert 'id="weather-panel"' not in response.text
  assert 'id="prop-panel"' not in response.text
  assert 'id="source-link"' in response.text


def test_root_injects_boundary_config(monkeypatch):
  monkeypatch.setattr(app, "TURNSTILE_ENABLED", False)
  monkeypatch.setattr(app, "MAP_BOUNDARY_MODE", "polygon")
  monkeypatch.setattr(app, "MAP_BOUNDARY_SHOW", True)
  monkeypatch.setattr(app, "get_map_boundary_name", lambda: "Test Boundary")
  monkeypatch.setattr(app, "get_map_boundary_points", lambda: [(42.1, -71.1), (42.2, -71.2), (42.3, -71.1)])

  client = TestClient(app.app)
  response = client.get("/")

  assert response.status_code == 200
  assert 'data-map-boundary-mode="polygon"' in response.text
  assert 'data-map-boundary-show="true"' in response.text
  assert 'data-map-boundary-name="Test Boundary"' in response.text
  assert '<script id="map-boundary-data" type="application/json">[[42.1, -71.1], [42.2, -71.2], [42.3, -71.1]]</script>' in response.text


def test_root_injects_qr_code_button_flag(monkeypatch):
  monkeypatch.setattr(app, "TURNSTILE_ENABLED", False)
  monkeypatch.setattr(app, "QR_CODE_BUTTON_ENABLED", True)

  client = TestClient(app.app)
  response = client.get("/")

  assert response.status_code == 200
  assert 'data-qr-code-button-enabled="true"' in response.text


def test_map_injects_route_history_and_peer_defaults(monkeypatch):
  monkeypatch.setattr(app, "TURNSTILE_ENABLED", False)
  monkeypatch.setattr(app, "ROUTE_HISTORY_ENABLED", True)
  monkeypatch.setattr(app, "ROUTE_BYTE_FILTER_DEFAULT", "2b,3b")
  monkeypatch.setattr(app, "HISTORY_BYTE_FILTER_DEFAULT", "1b")
  monkeypatch.setattr(app, "SHOW_REPEATERS_DEFAULT", True)
  monkeypatch.setattr(app, "SHOW_COMPANIONS_DEFAULT", False)
  monkeypatch.setattr(app, "SHOW_ROOM_SERVERS_DEFAULT", False)
  monkeypatch.setattr(app, "SHOW_UNKNOWN_DEFAULT", True)
  monkeypatch.setattr(app, "PEERS_DEFAULT_OPEN", True)

  client = TestClient(app.app)
  response = client.get("/map")

  assert response.status_code == 200
  assert response.headers.get("cache-control") == "no-store"
  assert 'data-route-history-enabled="true"' in response.text
  assert 'data-route-byte-filter-default="2b,3b"' in response.text
  assert 'data-history-byte-filter-default="1b"' in response.text
  assert 'data-show-repeaters-default="true"' in response.text
  assert 'data-show-companions-default="false"' in response.text
  assert 'data-show-room-servers-default="false"' in response.text
  assert 'data-show-unknown-default="true"' in response.text
  assert 'data-peers-default-open="true"' in response.text
  assert "{{ROUTE_HISTORY_ENABLED}}" not in response.text
  assert "{{ROUTE_BYTE_FILTER_DEFAULT}}" not in response.text
  assert "{{HISTORY_BYTE_FILTER_DEFAULT}}" not in response.text
  assert "{{SHOW_COMPANIONS_DEFAULT}}" not in response.text
  assert "{{SHOW_ROOM_SERVERS_DEFAULT}}" not in response.text
  assert "{{PEERS_DEFAULT_OPEN}}" not in response.text


def test_map_coordinate_embed_uses_static_og_image_only(monkeypatch):
  monkeypatch.setattr(app, "TURNSTILE_ENABLED", False)
  monkeypatch.setattr(app, "SITE_OG_IMAGE", "https://cdn.example/og.png")

  client = TestClient(app.app)
  response = client.get("/map?lat=42.13306&lon=-71.67163")

  assert response.status_code == 200
  assert 'property="og:image" content="https://cdn.example/og.png"' in response.text
  assert 'name="twitter:image" content="https://cdn.example/og.png"' in response.text
  assert "preview.png" not in response.text
  assert (
    'property="og:url" content="http://testserver/map?lat=42.13306'
    '&amp;lon=-71.67163"'
  ) in response.text


def test_preview_png_redirects_to_static_image_or_404(monkeypatch):
  client = TestClient(app.app)
  monkeypatch.setattr(app, "SITE_OG_IMAGE", "")
  assert client.get("/preview.png").status_code == 404
  monkeypatch.setattr(app, "SITE_OG_IMAGE", "https://cdn.example/og.png")
  response = client.get("/preview.png", follow_redirects=False)
  assert response.status_code == 302
  assert response.headers["location"] == "https://cdn.example/og.png"
