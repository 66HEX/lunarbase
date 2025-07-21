# Plan Migracji JWT z localStorage na httpOnly Cookies

## Przegląd

Celem tego planu jest migracja przechowywania tokenów JWT z `localStorage` na bezpieczne ciasteczka `httpOnly`, co znacznie zwiększy bezpieczeństwo aplikacji poprzez ochronę przed atakami XSS.

## Obecna Architektura

### Backend (Rust/Axum)
- **JWT Service**: `src/utils/jwt_service.rs` - generowanie i walidacja tokenów
- **Auth Middleware**: `src/middleware/auth.rs` - middleware autentykacji
- **Auth Handlers**: `src/handlers/auth.rs` - endpointy logowania/wylogowania
- **CORS**: `src/middleware/mod.rs` - konfiguracja CORS

### Frontend (React/TypeScript)
- **API Layer**: `admin-ui/src/lib/api.ts` - zarządzanie tokenami w localStorage
- **Auth Context**: `admin-ui/src/contexts/AuthContext.tsx` - kontekst autentykacji
- **Auth Stores**: `admin-ui/src/stores/auth.store.ts` i `auth-persist.store.ts` - Zustand stores
- **Auth Hook**: `admin-ui/src/hooks/useAuth.ts` - hook autentykacji

## Faza 1: Przygotowanie Backendu

### 1.1 Aktualizacja CORS
**Plik**: `src/middleware/mod.rs`

```rust
// Dodać obsługę credentials w CORS
.allow_credentials(true)
.allow_headers([AUTHORIZATION, CONTENT_TYPE, COOKIE])
```

### 1.2 Konfiguracja Ciasteczek
**Nowy plik**: `src/utils/cookie_service.rs`

- Funkcje do ustawiania/usuwania ciasteczek httpOnly
- Konfiguracja bezpieczeństwa (Secure, SameSite)
- Obsługa różnych środowisk (dev/prod)

### 1.3 Aktualizacja Auth Handlers
**Plik**: `src/handlers/auth.rs`

#### Login Handler
- Usunięcie tokenów z odpowiedzi JSON
- Dodanie ustawiania ciasteczek httpOnly
- Konfiguracja czasu wygaśnięcia ciasteczek

#### Refresh Handler
- Odczyt refresh token z ciasteczka
- Ustawienie nowych ciasteczek

#### Logout Handler
- Usunięcie ciasteczek (ustawienie pustych wartości z przeszłą datą)

### 1.4 Aktualizacja Auth Middleware
**Plik**: `src/middleware/auth.rs`

- Odczyt access token z ciasteczka zamiast nagłówka Authorization
- Zachowanie kompatybilności wstecznej (sprawdzanie obu źródeł)

## Faza 2: Przygotowanie Frontendu

### 2.1 Aktualizacja API Layer
**Plik**: `admin-ui/src/lib/api.ts`

- Usunięcie funkcji zarządzania localStorage
- Dodanie `credentials: 'include'` do wszystkich żądań
- Aktualizacja logiki odświeżania tokenów
- Usunięcie nagłówka Authorization

### 2.2 Aktualizacja Auth Context
**Plik**: `admin-ui/src/contexts/AuthContext.tsx`

- Usunięcie odwołań do localStorage
- Aktualizacja logiki sprawdzania autentykacji
- Nowa logika wykrywania wygaśnięcia sesji

### 2.3 Aktualizacja Auth Stores
**Pliki**: `admin-ui/src/stores/auth.store.ts` i `auth-persist.store.ts`

- Usunięcie zarządzania tokenami
- Uproszczenie stanu (tylko dane użytkownika)
- Aktualizacja akcji login/logout

### 2.4 Nowy Mechanizm Sprawdzania Autentykacji
**Nowy plik**: `admin-ui/src/lib/auth-check.ts`

- Endpoint `/auth/me` do sprawdzania stanu autentykacji
- Logika wykrywania wygaśnięcia sesji

## Faza 3: Implementacja Bezpieczeństwa

### 3.1 Konfiguracja Ciasteczek
- **httpOnly**: true (ochrona przed XSS)
- **Secure**: true w produkcji (tylko HTTPS)
- **SameSite**: "Strict" lub "Lax"
- **Path**: "/" dla access token, "/auth/refresh" dla refresh token

### 3.2 Obsługa CSRF
- Implementacja CSRF token (opcjonalnie)
- Walidacja Origin/Referer headers

### 3.3 Monitoring i Logowanie
- Logowanie prób nieautoryzowanego dostępu
- Metryki bezpieczeństwa

## Faza 4: Testowanie

### 4.1 Testy Jednostkowe
- Testy cookie service
- Testy auth middleware z ciasteczkami
- Testy frontend API bez localStorage

### 4.2 Testy Integracyjne
- Pełny flow logowania/wylogowania
- Odświeżanie tokenów
- Obsługa wygaśnięcia sesji

### 4.3 Testy Bezpieczeństwa
- Testy XSS (sprawdzenie, czy tokeny nie są dostępne z JS)
- Testy CSRF
- Testy różnych scenariuszy ataków

## Faza 5: Wdrożenie

### 5.1 Strategia Wdrożenia
1. **Kompatybilność wsteczna**: Backend obsługuje oba sposoby (ciasteczka + localStorage)
2. **Stopniowe wdrożenie**: Frontend przechodzi na ciasteczka
3. **Usunięcie starego kodu**: Po pełnej migracji

### 5.2 Rollback Plan
- Możliwość szybkiego powrotu do localStorage
- Monitoring błędów po wdrożeniu
- Plan komunikacji z użytkownikami

## Faza 6: Czyszczenie

### 6.1 Usunięcie Starego Kodu
- Usunięcie obsługi localStorage z frontendu
- Usunięcie kompatybilności wstecznej z backendu
- Aktualizacja dokumentacji

### 6.2 Optymalizacja
- Przegląd wydajności
- Optymalizacja rozmiaru ciasteczek
- Finalne testy bezpieczeństwa

## Harmonogram

| Faza | Czas | Opis |
|------|------|------|
| 1 | 2-3 dni | Przygotowanie backendu |
| 2 | 2-3 dni | Przygotowanie frontendu |
| 3 | 1-2 dni | Implementacja bezpieczeństwa |
| 4 | 2-3 dni | Testowanie |
| 5 | 1 dzień | Wdrożenie |
| 6 | 1 dzień | Czyszczenie |

**Całkowity czas**: 9-13 dni

## Korzyści

1. **Bezpieczeństwo**: Ochrona przed atakami XSS
2. **Automatyczne zarządzanie**: Przeglądarka automatycznie wysyła ciasteczka
3. **Lepsze UX**: Brak potrzeby ręcznego zarządzania tokenami
4. **Zgodność ze standardami**: Najlepsze praktyki bezpieczeństwa

## Ryzyka i Mitygacja

1. **Kompatybilność przeglądarek**: Testy na różnych przeglądarkach
2. **CORS issues**: Dokładna konfiguracja CORS
3. **Problemy z subdomenami**: Odpowiednia konfiguracja domain w ciasteczkach
4. **Debugging**: Nowe narzędzia do debugowania ciasteczek

## Następne Kroki

1. Przegląd i zatwierdzenie planu
2. Rozpoczęcie implementacji od Fazy 1
3. Regularne code review
4. Dokumentacja zmian
5. Przygotowanie środowiska testowego

---

*Plan utworzony: $(date)*
*Wersja: 1.0*