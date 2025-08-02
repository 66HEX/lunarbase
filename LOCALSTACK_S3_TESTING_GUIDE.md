# Przewodnik testowania S3 z LocalStack

Ten przewodnik opisuje jak skonfigurować i przetestować funkcjonalność uploadu plików S3 w Lunarbase używając LocalStack do lokalnego testowania.

## Wymagania wstępne

- Docker i Docker Compose zainstalowane na systemie
- AWS CLI zainstalowane (opcjonalne, do testowania)
- Backend Lunarbase z zaimplementowanym S3Service

## 1. Konfiguracja LocalStack

### Utwórz plik `docker-compose.localstack.yml`:

```yaml
version: '3.8'

services:
  localstack:
    container_name: lunarbase-localstack
    image: localstack/localstack:latest
    ports:
      - "4566:4566"            # LocalStack Gateway
      - "4510-4559:4510-4559"  # external services port range
    environment:
      # LocalStack configuration
      - DEBUG=1
      - SERVICES=s3
      - DOCKER_HOST=unix:///var/run/docker.sock
      - HOSTNAME_EXTERNAL=localhost
      - DATA_DIR=/tmp/localstack/data
      # AWS configuration
      - AWS_DEFAULT_REGION=us-east-1
      - AWS_ACCESS_KEY_ID=test
      - AWS_SECRET_ACCESS_KEY=test
    volumes:
      - "/tmp/localstack:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
    networks:
      - lunarbase-network

networks:
  lunarbase-network:
    driver: bridge
```

### Uruchom LocalStack:

```bash
# Uruchom LocalStack w tle
docker-compose -f docker-compose.localstack.yml up -d

# Sprawdź czy LocalStack działa
curl http://localhost:4566/health
```

## 2. Konfiguracja zmiennych środowiskowych

### Utwórz plik `.env.localstack` dla testów:

```bash
# ===========================================
# LOCALSTACK S3 CONFIGURATION
# ===========================================
S3_ENDPOINT_URL=http://localhost:4566
S3_BUCKET_NAME=lunarbase-test-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=test
S3_SECRET_ACCESS_KEY=test

# Pozostałe zmienne z głównego .env
DATABASE_URL=db.sqlite
SERVER_HOST=127.0.0.1
SERVER_PORT=3000
JWT_SECRET=test-jwt-secret
PASSWORD_PEPPER=test-pepper
FRONTEND_URL=http://localhost:3000
```

### Lub zaktualizuj główny plik `.env`:

```bash
# Dodaj/zaktualizuj sekcję S3 w .env
S3_ENDPOINT_URL=http://localhost:4566
S3_BUCKET_NAME=lunarbase-test-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=test
S3_SECRET_ACCESS_KEY=test
```

## 3. Inicjalizacja bucket S3

### Opcja A: Używając AWS CLI

```bash
# Skonfiguruj AWS CLI dla LocalStack
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1

# Utwórz bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://lunarbase-test-bucket

# Sprawdź czy bucket został utworzony
aws --endpoint-url=http://localhost:4566 s3 ls
```

### Opcja B: Używając curl

```bash
# Utwórz bucket przez REST API
curl -X PUT "http://localhost:4566/lunarbase-test-bucket" \
  -H "Authorization: AWS test:test" \
  -H "Content-Type: application/xml"

# Sprawdź listę buckets
curl "http://localhost:4566/" \
  -H "Authorization: AWS test:test"
```

### Opcja C: Automatyczna inicjalizacja przez skrypt

Utwórz plik `scripts/init-localstack.sh`:

```bash
#!/bin/bash

echo "Inicjalizacja LocalStack S3..."

# Czekaj aż LocalStack będzie gotowy
echo "Czekam na LocalStack..."
while ! curl -s http://localhost:4566/health > /dev/null; do
  sleep 1
done

echo "LocalStack jest gotowy!"

# Utwórz bucket
echo "Tworzę bucket lunarbase-test-bucket..."
aws --endpoint-url=http://localhost:4566 s3 mb s3://lunarbase-test-bucket

echo "Sprawdzam bucket..."
aws --endpoint-url=http://localhost:4566 s3 ls

echo "LocalStack S3 jest gotowy do testowania!"
```

Nadaj uprawnienia i uruchom:

```bash
chmod +x scripts/init-localstack.sh
./scripts/init-localstack.sh
```

## 4. Uruchomienie backendu z LocalStack

```bash
# Opcja A: Używając pliku .env.localstack
cp .env.localstack .env
cargo run

# Opcja B: Ustawiając zmienne bezpośrednio
S3_ENDPOINT_URL=http://localhost:4566 \
S3_BUCKET_NAME=lunarbase-test-bucket \
S3_REGION=us-east-1 \
S3_ACCESS_KEY_ID=test \
S3_SECRET_ACCESS_KEY=test \
cargo run
```

## 5. Testowanie funkcjonalności

### Test 1: Sprawdzenie health check S3

```bash
# Backend powinien logować przy starcie:
# "S3Service initialized successfully"
# Sprawdź logi backendu
```

### Test 2: Upload pliku przez API

```bash
# Najpierw utwórz kolekcję z polem file
curl -X POST "http://localhost:3000/api/collections" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "test-collection",
    "schema": {
      "name": {"type": "text", "required": true},
      "avatar": {"type": "file", "required": false}
    }
  }'

# Następnie prześlij rekord z plikiem
curl -X POST "http://localhost:3000/api/collections/test-collection/records" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F 'data={"name": "Test Record"}' \
  -F 'file_avatar=@/path/to/test/file.jpg'
```

### Test 3: Sprawdzenie plików w LocalStack

```bash
# Lista plików w bucket
aws --endpoint-url=http://localhost:4566 s3 ls s3://lunarbase-test-bucket/

# Pobierz plik
aws --endpoint-url=http://localhost:4566 s3 cp s3://lunarbase-test-bucket/FILENAME ./downloaded-file
```

### Test 4: Uruchomienie testów integracyjnych

```bash
# Uruchom testy z konfiguracją LocalStack
S3_ENDPOINT_URL=http://localhost:4566 \
S3_BUCKET_NAME=lunarbase-test-bucket \
S3_REGION=us-east-1 \
S3_ACCESS_KEY_ID=test \
S3_SECRET_ACCESS_KEY=test \
cargo test file_upload_integration_tests --test-threads=1
```

## 6. Debugowanie

### Sprawdzenie logów LocalStack:

```bash
docker logs lunarbase-localstack
```

### Sprawdzenie statusu LocalStack:

```bash
curl http://localhost:4566/health
```

### Sprawdzenie zawartości bucket:

```bash
# Przez AWS CLI
aws --endpoint-url=http://localhost:4566 s3 ls s3://lunarbase-test-bucket/ --recursive

# Przez curl
curl "http://localhost:4566/lunarbase-test-bucket/" \
  -H "Authorization: AWS test:test"
```

### Sprawdzenie logów backendu:

Sprawdź czy backend loguje:
- `S3Service initialized successfully` - przy starcie
- `Uploading file to S3` - podczas uploadu
- `File uploaded successfully` - po udanym uploadzie

## 7. Czyszczenie

### Zatrzymanie LocalStack:

```bash
docker-compose -f docker-compose.localstack.yml down
```

### Usunięcie danych LocalStack:

```bash
docker-compose -f docker-compose.localstack.yml down -v
sudo rm -rf /tmp/localstack
```

## 8. Rozwiązywanie problemów

### Problem: "Bucket does not exist"
**Rozwiązanie**: Upewnij się, że bucket został utworzony przed uruchomieniem backendu.

### Problem: "Connection refused"
**Rozwiązanie**: Sprawdź czy LocalStack działa na porcie 4566.

### Problem: "Access Denied"
**Rozwiązanie**: Sprawdź konfigurację AWS credentials (test/test).

### Problem: "S3Service initialization failed"
**Rozwiązanie**: Sprawdź zmienne środowiskowe S3 i czy LocalStack jest dostępny.

## 9. Przydatne komendy

```bash
# Restart LocalStack
docker-compose -f docker-compose.localstack.yml restart

# Sprawdź wszystkie kontenery
docker ps

# Sprawdź porty
netstat -tulpn | grep 4566

# Sprawdź zmienne środowiskowe
env | grep S3
```

## 10. Integracja z CI/CD

Dla automatycznych testów, możesz dodać LocalStack do pipeline:

```yaml
# Przykład dla GitHub Actions
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - 4566:4566
    env:
      SERVICES: s3
      DEBUG: 1
      AWS_DEFAULT_REGION: us-east-1
      AWS_ACCESS_KEY_ID: test
      AWS_SECRET_ACCESS_KEY: test
```

Ten przewodnik powinien umożliwić pełne testowanie funkcjonalności S3 w środowisku lokalnym bez konieczności używania prawdziwego AWS S3.