# Logistics Quoting System — Implementation Plan

## Collaboration Rule

**Do not edit the code. Do not add project files.**
Guide with exact details so I implement every change myself.
This is my learning project — every file I touch, I type.

---

## Project Orientation

The existing Laravel 13 + React/TypeScript codebase (auth + MFA) becomes the **auth layer**.
All new modules extend the same repo: same Laravel backend, same React client (`client/`), same PostgreSQL.

**Critical prerequisite before any module:** the schema has weight bands (`weight_from`, `weight_to`) but the original formula used a flat `rate_per_kg`. These must agree before anything else is built. Module 0 fixes this first.

---

## Progress Tracker

| Module | Name | Status | Started | Completed |
|--------|------|--------|---------|-----------|
| 0 | Data Model | ⬜ Not started | — | — |
| 1 | Bulk Ingestion | ⬜ Not started | — | — |
| 2 | Pricing Engine | ⬜ Not started | — | — |
| 2b | CI/CD — Hostinger VPS | ⬜ Not started | — | — |
| 3 | Query Performance | ⬜ Not started | — | — |
| 4 | External API | ⬜ Not started | — | — |
| 5 | Queue vs Pub/Sub | ⬜ Not started | — | — |
| 6 | Redis Architecture | ⬜ Not started | — | — |
| 7 | React Frontend | ⬜ Not started | — | — |
| 8 | Tests + CI | ⬜ Not started | — | — |
| 9 | Safe Migration | ⬜ Not started | — | — |
| 10 | Kubernetes | ⬜ Not started | — | — |

| Drill | Name | Status |
|-------|------|--------|
| A | Safe migration (expand/contract) | ⬜ Not started |
| B | Silent job failure | ⬜ Not started |
| C | $0 quote incident | ⬜ Not started |
| D | Scaling 100→100k req/day | ⬜ Not started |
| E | TypeScript `any` cleanup | ⬜ Not started |
| F | Bad PR review | ⬜ Not started |

---

## Execution Order

```
Week 1:  Module 0 (schema + band formula fix) + Module 3 seeder (10M rows)
Week 2:  Module 2 (pricing engine) + Module 6 (Redis)
Week 2:  Module 2 (pricing engine) + Module 2b (CI/CD) + Module 6 (Redis)
Week 3:  Module 1 (ingestion) + Module 4 (API)
Week 4:  Module 5 (events) + Module 7 (React UI)
Week 5:  Module 8 (tests + CI) + Module 9 (safe migration)
Week 6:  Module 10 (k8s) + Drills A–C
Week 7:  Drills D–F + docs polish
```

---

## Module 0 — Data Model

**Interview scenario:** DB design  
**Runs:** Local PostgreSQL  
**Status:** ⬜ Not started

**Goal:** Foundation schema with temporal rate cards and weight-band items.

### Files to create

```
database/migrations/2026_05_30_000001_create_carriers_table.php
database/migrations/2026_05_30_000002_create_customers_table.php
database/migrations/2026_05_30_000003_create_rate_cards_table.php
database/migrations/2026_05_30_000004_create_rate_card_items_table.php
database/migrations/2026_05_30_000005_create_shipments_table.php
database/migrations/2026_05_30_000006_create_quotes_table.php
app/Models/Carrier.php
app/Models/Customer.php
app/Models/RateCard.php
app/Models/RateCardItem.php
app/Models/Shipment.php
app/Models/Quote.php
database/seeders/CarrierSeeder.php
database/seeders/CustomerSeeder.php
database/seeders/RateCardSeeder.php
```

### Schema

**carriers**
```
id, name, code (unique), active (boolean default true),
created_at, updated_at
```

**customers**
```
id, name, code (unique), margin_pct (numeric 5,2 default 0),
api_key (unique, indexed), created_at, updated_at
```

**rate_cards** — temporal header, soft-deleted to keep history
```
id, carrier_id (FK → carriers), valid_from (date),
valid_to (date, nullable), deleted_at, created_at, updated_at
INDEX: (carrier_id, valid_from, valid_to)
```

**rate_card_items** — weight bands per zone
```
id, rate_card_id (FK → rate_cards), zone (varchar 10),
weight_from (numeric 8,3), weight_to (numeric 8,3),
price_per_kg (numeric 10,4), base_rate (numeric 10,4),
created_at, updated_at
INDEX: (rate_card_id, zone, weight_from, weight_to)
```

**shipments**
```
id, customer_id (FK → customers),
origin_zone (varchar 10), destination_zone (varchar 10),
weight (numeric 8,3),
status (enum: pending, in_transit, delivered),
delivered_at (nullable timestamp),
created_at, updated_at
```

**quotes**
```
id, shipment_id (FK → shipments), carrier_id (FK → carriers),
rate_card_item_id (FK → rate_card_items),
base_rate, weight_cost, distance_cost, margin, total_price,
calculated_at (timestamp), created_at
DB CHECK CONSTRAINT: total_price > 0
```

### Band-lookup formula fix

The schema defines weight bands. The formula must use a band lookup, not a flat rate.

```php
// PricingService::getQuote() — band-aware
$item = RateCardItem::where('rate_card_id', $rateCard->id)
    ->where('zone', $zone)
    ->where('weight_from', '<=', $weight)
    ->where('weight_to', '>=', $weight)
    ->firstOrFail();

$weightCost   = $weight * $item->price_per_kg;
$distanceCost = $this->distanceFee($origin, $destination);
$margin       = ($item->base_rate + $weightCost + $distanceCost)
                * ($customer->margin_pct / 100);
$total        = $item->base_rate + $weightCost + $distanceCost + $margin;

throw_if($total <= 0, PricingException::class, 'Quote must be > 0');
```

### Model traits

- `RateCard` → `use SoftDeletes;` + `hasMany(RateCardItem::class)`
- `Carrier` → `hasMany(RateCard::class)`
- `Customer` → `hasMany(Shipment::class)`
- `Shipment` → `hasMany(Quote::class)`
- `Quote` → `belongsTo(Carrier::class)`, `belongsTo(RateCardItem::class)`

### Seeders

- `CarrierSeeder` — 5 carriers, 2 active rate cards each, 10 zones × 5 weight bands = 100 items per card
- `CustomerSeeder` — 20 customers, each with a unique `api_key` via `Str::random(40)`
- `RateCardSeeder` — called from `CarrierSeeder`; `valid_from = today`, `valid_to = null`

### First steps (do these in order)

1. Run `php artisan make:migration create_carriers_table` — fill it in, migrate
2. Run `php artisan make:migration create_customers_table` — fill, migrate
3. Run `php artisan make:migration create_rate_cards_table` — include soft deletes + index
4. Run `php artisan make:migration create_rate_card_items_table` — include composite index
5. Run `php artisan make:migration create_shipments_table`
6. Run `php artisan make:migration create_quotes_table` — add the `total_price > 0` DB check
7. Create each Model with correct `$fillable`, casts, relationships
8. Write seeders and register them in `DatabaseSeeder`
9. Write `PricingService` with band lookup
10. Write unit test: seed one rate card with two weight bands, assert the correct band is selected

---

## Module 1 — Bulk Ingestion

**Interview scenario:** Upload 1000s of rows (img 18, 1)  
**Runs:** Local + real S3/SQS  
**Status:** ⬜ Not started

**Goal:** Excel → S3 → SQS queue → validate rows → upsert rate card items → poll job status.

### Files to create

```
app/Jobs/ProcessManifestJob.php
app/Http/Controllers/ManifestController.php
app/Services/ManifestParserService.php
app/Models/ManifestUpload.php
database/migrations/..._create_manifest_uploads_table.php
```

### manifest_uploads table

```
id, carrier_id (FK), original_filename, s3_path,
status (enum: pending, processing, completed, failed),
total_rows, valid_rows, invalid_rows (JSON),
created_at, updated_at
```

### Flow

```
POST /api/manifests/upload
  → validate: xlsx only, max 10MB
  → store to S3: manifests/{uuid}.xlsx
  → create ManifestUpload (status=pending)
  → dispatch ProcessManifestJob onto SQS queue
  → return { job_id, status_url }

ProcessManifestJob::handle()
  → update status=processing
  → download xlsx from S3
  → parse rows with PhpSpreadsheet
  → validate each row: zone not empty, weight_from < weight_to, price_per_kg > 0
  → DB transaction:
      soft-delete old rate card for carrier
      insert new rate_card record
      insert rate_card_items in bulk (insert or upsert)
  → update ManifestUpload: status=completed|failed, invalid_rows JSON

GET /api/manifests/{id}/status
  → return { status, total_rows, valid_rows, invalid_rows }
```

### Packages needed

```bash
composer require phpoffice/phpspreadsheet
composer require aws/aws-sdk-php
```



---

## Module 1b — Bulk Ingestion Extensions

**Status:** ⬜ Not started  
**Depends on:** Module 1, Module 7 (frontend polling)

### Features to complete

| Feature | Current state | Gap |
|---------|--------------|-----|
| Column name handling | Fixed positions A–E | Detect header row, map by name so different column order still parses |
| Schema validation | Checks value ranges only | Reject rows with missing columns or non-numeric values |
| Upsert | Soft-delete + bulk INSERT | Replace with `RateCardItem::upsert()` on `[rate_card_id, zone, weight_from, weight_to]` |
| Intra-file duplicate detection | Not checked | Deduplicate `valid_rows` by `zone + weight_from + weight_to` before inserting; collect dupes into `invalid_rows` |
| Progress granularity | `pending → processing → completed` only | Update `total_rows` after parsing so poll shows mid-job progress |
| User notification | Poll endpoint only | Fire `ManifestProcessed` event on completion (Module 5); listener sends email or push |
| Frontend polling | Manual curl only | `JobStatusPoller` component (Module 7) polls every 3s, renders progress bar and `InvalidRowsTable` |

### Implementation notes

**Flexible column names**
```php
$headers = array_map('strtolower', array_map('trim', $rows[0]));
$map = array_flip($headers); // ['zone' => 0, 'weight_from' => 1, ...]
// then access by $map['zone'] instead of hardcoded 'A'

```
---

## Module 2 — Pricing Engine


**Interview scenario:** Pricing algorithm (img 16)  
**Runs:** Local  
**Status:** ⬜ Not started

**Goal:** `getQuote()` with Redis-cached rate cards, weight-band lookup, ranked carrier results.

### Files to create

```
app/Services/PricingService.php
app/Http/Controllers/QuoteController.php
app/Cache/RateCardCache.php
app/Exceptions/PricingException.php
```

### Cache strategy — Redis DB 0

```php
// Key pattern: rate_card:{carrier_id}:{date}
// TTL: 3600 seconds
// Invalidated when rate card saved or deleted (Model observer in Module 6)

public function getActiveRateCard(int $carrierId, Carbon $date): RateCard
{
    $cacheKey = "rate_card:{$carrierId}:{$date->toDateString()}";

    return Cache::remember($cacheKey, 3600, function () use ($carrierId, $date) {
        return RateCard::where('carrier_id', $carrierId)
            ->where('valid_from', '<=', $date)
            ->where(fn($q) => $q->whereNull('valid_to')
                               ->orWhere('valid_to', '>=', $date))
            ->whereNull('deleted_at')
            ->with('items')
            ->latest('valid_from')
            ->firstOrFail();
    });
}
```

### Fallback rule

If no current rate card exists for a carrier, fall back to the earliest available rate card.
Log the fallback with `Log::warning('Rate card fallback used', [...])` — it signals stale data.

### Output

Return all eligible carriers sorted by `total_price` ascending. Caller sees cheapest-first.


---


## Module 2b — CI/CD Pipeline (Hostinger VPS)

**Interview scenario:** Deployment pipeline design  
**Runs:** GitHub Actions → Hostinger VPS  
**Status:** ⬜ Not started

**Goal:** CI on every push, CD to Hostinger VPS on merge to master.

### Files to create


---

## Module 3 — Query Performance

**Interview scenario:** Slow query (img 17), N+1 (img 7)  
**Runs:** Local PostgreSQL  
**Status:** ⬜ Not started

**Goal:** 10M-row seed, EXPLAIN ANALYZE before/after index fix, N+1 demo + eager-load fix.

### Files to create

```
database/seeders/LargeShipmentSeeder.php
app/Console/Commands/SeedLargeDataset.php
docs/drill-query-perf.md
```

### 10M-row seeder strategy

Use PostgreSQL `COPY` — 10–50× faster than Eloquent inserts.

```php
// In SeedLargeDataset command:
// 1. Generate a CSV file with 10M rows using PHP
// 2. COPY into shipments table directly
DB::statement("COPY shipments (customer_id, origin_zone, destination_zone, weight, status, created_at)
               FROM '/tmp/shipments_10m.csv'
               WITH (FORMAT csv, HEADER true)");
```

### Slow query to plant (intentionally)

```php
// No index on (customer_id, created_at) → full seq scan on 10M rows
Shipment::where('customer_id', $id)
    ->whereBetween('created_at', [$start, $end])
    ->get();
```

Run `EXPLAIN ANALYZE` on this. Record output in `docs/drill-query-perf.md`.

### Fix

```php
// New migration: add composite index
$table->index(['customer_id', 'created_at']);
```

Run `EXPLAIN ANALYZE` again. Record the difference. The plan should switch from Seq Scan to Index Scan.

### N+1 to plant

```php
// Bad: N+1 — each quote lazy-loads carrier (1 + N queries)
$quotes = Quote::all();
foreach ($quotes as $q) {
    echo $q->carrier->name;
}

// Fix: eager load
$quotes = Quote::with('carrier')->get();
```

Use Laravel Debugbar or `DB::enableQueryLog()` to show the query count difference.

---

## Module 4 — External API

**Interview scenario:** API design (img 14)  
**Runs:** Local  
**Status:** ⬜ Not started

**Goal:** `/v1/quotes`, API-key auth, idempotency, per-key rate limiting, Swagger docs, versioning.

### Files to create

```
app/Http/Middleware/ApiKeyAuth.php
app/Http/Controllers/Api/V1/QuoteController.php
app/Http/Controllers/Api/V1/ShipmentController.php
routes/api_v1.php
```

### Route structure

```
/v1/quotes             POST   — create quote (returns ranked list)
/v1/quotes/{id}        GET    — retrieve a specific quote
/v1/shipments          POST   — create shipment
/v1/shipments/{id}     GET    — get shipment + its quotes
```

All routes: middleware `['api.key', 'throttle:api']`

### API key middleware

```php
// app/Http/Middleware/ApiKeyAuth.php
$customer = Customer::where('api_key', $request->header('X-API-Key'))->first();
abort_if(!$customer, 401, 'Invalid API key');
$request->merge(['authenticated_customer' => $customer]);
```

Register in `bootstrap/app.php` as route middleware alias `'api.key'`.

### Idempotency

- Accept `Idempotency-Key` header on POST requests
- On first request: process normally, store `idempotency:{key} → quote_id` in Redis DB 1 with 24h TTL
- On duplicate key: return the original stored response, no second DB write
- Return `X-Idempotent-Replayed: true` header on replayed responses

### Rate limiting

```php
// In AppServiceProvider::boot()
RateLimiter::for('api', function (Request $request) {
    return Limit::perMinute(60)->by($request->header('X-API-Key'));
});
```

Per API key, not per IP. Returns HTTP 429 with `Retry-After` header on breach.

### Versioning

- `routes/api_v1.php` for all v1 routes
- When breaking changes come: create `routes/api_v2.php` + `V2` controller namespace
- Never URL-version inside a single controller — separate files only

### Swagger

```bash
composer require darkaonline/l5-swagger
php artisan vendor:publish --provider "L5Swagger\L5SwaggerServiceProvider"
```

Add `@OA\` annotations to controllers. Docs accessible at `/api/documentation`.

---

## Module 5 — Queue vs Pub/Sub

**Interview scenario:** Queue vs pub/sub (img 13)  
**Runs:** Local + real SQS  
**Status:** ⬜ Not started

**Goal:** SQS for point-to-point bulk jobs. Laravel Events for fan-out shipment lifecycle.

### Files to create

```
app/Events/ShipmentDelivered.php
app/Listeners/TriggerBillingListener.php
app/Listeners/SendDeliveryNotificationListener.php
app/Listeners/RecordCarbonFootprintListener.php
app/Providers/EventServiceProvider.php  (modify)
```

### Event + 3 listeners

```php
// ShipmentDelivered event
class ShipmentDelivered {
    public function __construct(public Shipment $shipment) {}
}

// EventServiceProvider
ShipmentDelivered::class => [
    TriggerBillingListener::class,        // creates invoice record
    SendDeliveryNotificationListener::class, // sends email/push
    RecordCarbonFootprintListener::class, // logs CO2 estimate
],
```

### The interview distinction

- **SQS (point-to-point):** one producer, one consumer, guaranteed delivery + retry, used for `ProcessManifestJob`
- **Laravel Events (fan-out/pub-sub):** one event, multiple independent in-process consumers, used when side-effects are decoupled but share the same request lifecycle
- If listeners need to survive crashes independently, make them `ShouldQueue` + point at SQS

---

## Module 6 — Redis Architecture

**Interview scenario:** Redis fundamentals (img 9, 16)  
**Runs:** Local (Docker container)  
**Status:** ⬜ Not started

**Goal:** 5 logical DBs, cache invalidation on rate card change, persistence discussion.

### Logical DB map

| DB | Purpose | Key pattern | TTL |
|----|---------|-------------|-----|
| 0 | Rate card cache | `rate_card:{carrier_id}:{date}` | 3600s |
| 1 | Idempotency keys | `idempotency:{key}` | 86400s |
| 2 | Rate limiting | Laravel throttle keys | 60s |
| 3 | Job status | `job:status:{manifest_id}` | 3600s |
| 4 | Session store | Laravel session keys | session TTL |

Configure in `config/database.php` under `redis.connections` with separate `database` numbers.

### Cache invalidation on rate card change

```php
// app/Models/RateCard.php
protected static function booted(): void
{
    static::saved(fn(RateCard $rc) => self::bustCache($rc));
    static::deleted(fn(RateCard $rc) => self::bustCache($rc));
}

private static function bustCache(RateCard $rc): void
{
    $pattern = "rate_card:{$rc->carrier_id}:*";
    $keys = Redis::connection('cache')->keys($pattern);
    if ($keys) {
        Redis::connection('cache')->del($keys);
    }
}
```

This wires Module 2's cache to Module 6's invalidation — any rate card save/soft-delete clears all cached entries for that carrier.

### Persistence note (for interviews)

- DB 0–3 are reconstructable from Postgres → use `allkeys-lru` eviction, AOF not required
- DB 4 (sessions) should have persistence enabled (AOF) or use a separate Redis instance
- Never store sessions and cache in the same Redis instance in production

---

## Module 7 — React Frontend

**Interview scenario:** Job status mechanism (img 18)  
**Runs:** Local  
**Status:** ⬜ Not started

**Goal:** Upload UI with job-status polling, quote request form, rate-card explorer.

### Files to create

```
client/src/components/manifest/ManifestUpload.tsx
client/src/components/manifest/JobStatusPoller.tsx
client/src/components/manifest/InvalidRowsTable.tsx
client/src/components/quotes/QuoteForm.tsx
client/src/components/quotes/QuoteResults.tsx
client/src/components/rate-cards/RateCardExplorer.tsx
client/src/api/manifestApi.ts
client/src/api/quoteApi.ts
```

### Polling pattern

```typescript
useEffect(() => {
    if (status === 'completed' || status === 'failed') return;

    const id = setInterval(async () => {
        const res = await fetch(`/api/manifests/${jobId}/status`);
        const data = await res.json();
        setStatus(data.status);
        setInvalidRows(data.invalid_rows ?? []);
        if (data.status !== 'pending' && data.status !== 'processing') {
            clearInterval(id);
        }
    }, 3000);

    return () => clearInterval(id);
}, [jobId, status]);
```

### Component responsibilities

- `ManifestUpload` — file picker, validates xlsx client-side, POSTs to `/api/manifests/upload`, hands `job_id` to `JobStatusPoller`
- `JobStatusPoller` — polls every 3s, shows progress bar, renders `InvalidRowsTable` on completion
- `InvalidRowsTable` — table of rejected rows with row number + reason
- `QuoteForm` — inputs: origin zone, destination zone, weight → POST `/v1/quotes` with `X-API-Key` header
- `QuoteResults` — ranked list of carriers with price breakdown (base + weight + distance + margin)
- `RateCardExplorer` — list of carriers → click to expand → zone/weight-band table

---

## Module 8 — Tests + CI

**Interview scenario:** Writing tests (img 12)  
**Runs:** Local + GitHub Actions  
**Status:** ⬜ Not started

**Goal:** Unit tests for pricing/validation, integration tests for ingestion/quote flow, CI on every PR.

### Files to create

```
tests/Unit/PricingServiceTest.php
tests/Unit/ManifestParserTest.php
tests/Feature/QuoteFlowTest.php
tests/Feature/ManifestIngestionTest.php
tests/Feature/ApiKeyAuthTest.php
.github/workflows/backend-tests.yml  (modify existing)
```

### Key test cases

**PricingServiceTest**
- Correct band selected when weight falls in middle band
- Correct band selected when weight is exactly on a boundary
- `PricingException` thrown when no band matches
- `PricingException` thrown when `total_price` would be 0 or negative
- Margin correctly applied to subtotal, not just weight cost

**ManifestParserTest**
- Valid rows parsed into correct `RateCardItem` shape
- Row rejected when `weight_from >= weight_to`
- Row rejected when `price_per_kg <= 0`
- Row rejected when `zone` is empty
- Returns correct count of valid vs invalid rows

**QuoteFlowTest**
- Seed rate card → POST `/v1/quotes` → assert response has `ranked_quotes` array
- Assert cheapest carrier is first
- Assert each quote has `base_rate`, `weight_cost`, `distance_cost`, `margin`, `total_price`

**ApiKeyAuthTest**
- Missing `X-API-Key` → 401
- Invalid key → 401
- Valid key → 200
- Valid key + 61 requests in 1 minute → 429

### $0 quote guard test (Drill C prerequisite)

```php
public function test_quote_total_is_never_zero(): void
{
    RateCardItem::factory()->create(['price_per_kg' => 0, 'base_rate' => 0]);
    $this->expectException(PricingException::class);
    app(PricingService::class)->getQuote(/* ... */);
}
```

### CI additions

Add to `.github/workflows/backend-tests.yml`:
- Redis service container (for cache tests)
- `php artisan db:seed --class=TestSeeder` before test run
- `php artisan test --coverage --min=80`

---

## Module 9 — Safe Migration

**Interview scenario:** 50M-row migration (img 1)  
**Runs:** Local PostgreSQL (10M rows from Module 3)  
**Status:** ⬜ Not started

**Goal:** Add a column to the 10M-row shipments table using expand/contract. Observe lock behavior.

### Files to create

```
database/migrations/..._add_carrier_reference_to_shipments.php
app/Console/Commands/BackfillCarrierReference.php
docs/drill-safe-migration.md
```

### Three phases

**Phase 1 — Expand**
```php
// Migration: nullable column with no default = instant DDL in Postgres (no rewrite)
$table->string('carrier_reference')->nullable()->after('status');
```
Ship this. App reads old schema — `carrier_reference` is null for existing rows.

**Phase 2 — Backfill (artisan command, not a migration)**
```php
// BackfillCarrierReference::handle()
Shipment::whereNull('carrier_reference')
    ->chunkById(10000, function ($chunk) {
        foreach ($chunk as $shipment) {
            $shipment->update([
                'carrier_reference' => 'REF-' . str_pad($shipment->id, 8, '0', STR_PAD_LEFT)
            ]);
        }
    });
```
Run with and without `chunkById`. Observe lock behavior each time. Document in `docs/drill-safe-migration.md`.

**Phase 3 — Contract**
```php
// After all rows are backfilled:
$table->string('carrier_reference')->nullable(false)->change();
```

### What to document

- DDL lock duration: nullable add (Phase 1) vs NOT NULL change (Phase 3)
- Query plan difference: `chunkById` batching vs single bulk update
- How `expand/contract` lets you deploy in stages without downtime

---

## Module 10 — Kubernetes

**Interview scenario:** Horizontal scaling (img 2)  
**Runs:** kind locally; one EKS demo  
**Status:** ⬜ Not started

**Goal:** kind cluster, ingress for Laravel API, HPA on quote endpoint, load test with k6.

### Files to create

```
k8s/namespace.yaml
k8s/postgres-secret.yaml
k8s/api-deployment.yaml
k8s/api-service.yaml
k8s/ingress.yaml
k8s/hpa.yaml
k8s/worker-deployment.yaml
k8s/kind-config.yaml
load-tests/quote-load.js
```

### Manifests summary

**api-deployment.yaml**
- 2 replicas, resource limits: `cpu: 250m`, `memory: 256Mi`
- Liveness probe: `GET /api/health`

**hpa.yaml**
- `minReplicas: 2`, `maxReplicas: 10`
- `targetCPUUtilizationPercentage: 60`

**worker-deployment.yaml**
- Runs `php artisan queue:work --queue=manifests`
- 1 replica (scale manually when queue depth grows)

### Local setup

```bash
kind create cluster --name logistics --config k8s/kind-config.yaml
kubectl apply -f k8s/
kubectl get pods -n logistics
```

### Drill D tie-in

```bash
# k6 load test
k6 run load-tests/quote-load.js

# Watch HPA fire
kubectl get hpa -n logistics --watch
```
Record before/after req/sec in `docs/drill-scaling.md`.

---

## Break-Fix Drills

Each drill has three acts: **plant the bug → reproduce the symptom → diagnose and fix**.
Document each in `docs/drill-*.md` using: **What broke → How I found it → The fix → The guard I added**.

---

### Drill A — Safe Migration

**Status:** ⬜ Not started  
**Doc:** `docs/drill-safe-migration.md`  
**Plant:** Run `ALTER TABLE` adding `NOT NULL` column without default on 10M-row table. Observe table lock.  
**Diagnose:** `pg_stat_activity` to see blocking queries. `pg_locks` to confirm lock held.  
**Fix:** Phase 1: nullable add. Phase 2: batched backfill. Phase 3: NOT NULL constraint.

---

### Drill B — Silent Job Failure

**Status:** ⬜ Not started  
**Doc:** `docs/drill-silent-job.md`  
**Plant:** In `ProcessManifestJob::handle()`, wrap the upsert in a `try/catch` that catches all exceptions, rolls back the transaction, but does NOT re-throw.  
**Symptoms:** Job disappears from queue. No entry in `failed_jobs`. Status stays `processing`.  
**Debug path:**
1. Check `failed_jobs` table — empty (confirms exception was swallowed)
2. Add `Log::info('Job started', ['id' => $this->manifest->id])` at top of `handle()`
3. Confirm worker is actually running: `php artisan queue:work --verbose`
4. Add temporary `Log::error` inside the catch block
5. Check `QUEUE_CONNECTION` in `.env` — `sync` hides failures differently than `redis`/`sqs`

**Fix:** Re-throw inside catch, or let Laravel's failed job handler do it. Never swallow exceptions in jobs.

---

### Drill C — The $0 Quote Incident

**Status:** ⬜ Not started  
**Doc:** `docs/drill-zero-quote.md`  
**Plant:** In `RateCardSeeder`, set `price_per_kg = null` for one carrier's items.  
**Symptoms:** Some quotes return `total_price = 0`. Others are fine.  
**Triage steps:**
1. Scope it: is it one carrier or all? Filter quotes by carrier.
2. Check recent commits: `git log --oneline -10`
3. Read logs around quote calculation
4. Decide: rollback seeder (if prod) vs targeted fix
**Fix:** Add `throw_if($total <= 0, PricingException::class)` in `PricingService`. Add DB `CHECK total_price > 0` on quotes table. Add test asserting quotes never return ≤ 0.  
**Postmortem:** Write a 1-paragraph postmortem in the doc.

---

### Drill D — Scaling 100→100k req/day

**Status:** ⬜ Not started  
**Doc:** `docs/drill-scaling.md`  
**Plant:** Remove Redis cache from `PricingService`. Remove composite index from `shipments`.  
**Load test:** `k6 run load-tests/quote-load.js` — watch it degrade.  
**Apply fixes in order:**
1. Add missing composite index → re-test, record improvement
2. Re-add Redis caching for rate cards → re-test
3. Check DB connection pool config (`DB_POOL` in `.env`)
4. Add per-key rate limiting → re-test
5. Scale replicas in kind cluster → re-test  
**Record:** before/after req/sec at each step.

---

### Drill E — TypeScript `any` Cleanup

**Status:** ⬜ Not started  
**Doc:** `docs/drill-typescript-any.md`  
**Plant:** Add `any` to `QuoteForm` props, `QuoteResults` response type, `ManifestUpload` file handler.  
**Trigger:** Enable `"noImplicitAny": true` in `client/tsconfig.json` → TypeScript fails to compile.  
**Fix each:**
- Props interfaces: define explicit shape instead of `any`
- API responses: define response types or use `unknown` with a type guard
- Event handlers: use `React.ChangeEvent<HTMLInputElement>` instead of `any`  
**Document:** Why `noImplicitAny` matters — it forces every assumption about shape to be explicit at the type level.

---

### Drill F — Bad PR Review

**Status:** ⬜ Not started  
**Doc:** `docs/drill-bad-pr.md`  
**Plant:** Write a branch with:
- Raw SQL with string interpolation (SQL injection risk)
- No request validation on a POST endpoint
- No error handling (bare database call, no try/catch)
- A variable named `$x`
- A `TODO` left in production code

**Practice:** Review your own PR. For each issue:
- Add an inline comment explaining why it is wrong
- Suggest the correct fix (Eloquent/query builder, `$request->validate()`, try/catch, descriptive name)  
**The muscle being built:** Spotting these in others' code before they reach main.

---

## AWS Cost Posture

| Concern | Approach | Cost |
|---------|----------|------|
| Postgres 10M rows, migrations, EXPLAIN | Local Postgres (same engine as RDS) | $0 |
| Redis (cache, queue, pub/sub, rate limit) | Local Docker container, 5 logical DBs | $0 |
| S3 + SQS | Real AWS, Always Free tier | ~$0 |
| Kubernetes + scaling drill | kind locally; one EKS spin-up/tear-down | ~$5–10 once |
| CI | GitHub Actions (free public repo) | $0 |

---

## Docs Folder Structure

Each drill and module produces a markdown file here. These are your interview cheat sheets.

```
docs/
  drill-safe-migration.md     — Drill A
  drill-silent-job.md         — Drill B
  drill-zero-quote.md         — Drill C
  drill-scaling.md            — Drill D
  drill-typescript-any.md     — Drill E
  drill-bad-pr.md             — Drill F
  module-0-schema.md          — ERD notes + band formula decision
  module-3-query-perf.md      — EXPLAIN ANALYZE before/after
  MFA_TESTS_EXPLANATION.md    — (existing)
```

---

*Last updated: 2026-05-31*
