# Microalpha Dashboard v10 — Documentație Tehnică

## Fișier
- **Path:** `Microalpha_Dashboard_v10.html`
- **Tip:** Single-file React 18 app (JSX inline, Babel standalone)
- **Total:** ~930 linii HTML, ~77KB JSX
- **Persistență:** `localStorage` key `microalpha_v10`
- **Auth:** admin / MicroAlpha2026!

## Stack & CDN-uri
- React 18 + ReactDOM (unpkg.com, UMD)
- PropTypes (unpkg.com)
- Recharts (unpkg.com) — BarChart, PieChart, LineChart, AreaChart
- Babel standalone (unpkg.com) — compilare JSX in-browser
- Google Fonts Inter (wght 300-800)

## Structura fișierului

### CSS (linii 1-91)
- Dark theme: `--bg:#0a0e1a`, `--card:#111827`, `--card2:#1e293b`
- Clase: `.card`, `.btn`, `.btn-o`, `.btn-red`, `.g2`, `.g4`, `.tab-btn`, `.badge` (`.bg`,`.br`,`.by`,`.bb`,`.bp`)
- `.excluded-row` (opacity .4, line-through)
- `.cat-sel` (dropdown categories)
- `.collapsible-header` (expandable sections)

### Constante (linii 93-103)
- `MRO[]` — luni complete română ("Ianuarie"..."Decembrie")
- `MS[]` — luni scurte ("Ian"..."Dec")
- `C{}` — culori (blue, green, red, yellow, purple, cyan)
- `PC[]` — palette chart (6 culori)
- `fmt()` — format număr compact (K, M)
- `ff()` — format număr cu separatori mii
- `pct()`, `gw()` — procent, growth
- `AUTH_USER`, `AUTH_PASS`
- `DEFAULT_DATA` — structură goală cu months[], bankStatement[], renewals{}, sources[]

### Funcții core (linii 104-194)

**`computeRenewals(data)` [104-130]**
- Input: data cu months[].transactions
- Construiește lista clienți cu status Pending/Renewed/Churned
- Calculează daysLeft pe baza validity (annual=365, monthly=30)
- Return: `{total, nextMonthDue, byStatus, clients[]}`

**`integrateExpenses(data)` [131-153]**
- Distribuie cheltuieli din bankStatement pe luni (după dată)
- Categorizare: `t.expenseCategory || t.category || 'Necategorizat'`
- Calculează `capitalInflows` din bankStatement cu incomeType='Capital Social'
- Running balance: `runBal += totalIncasari + capitalInflows - expenses.total`
- Adaugă pe fiecare lună: expenses, capitalInflows, cashInflows, cashBalance

**`fetchAppsScript(scriptUrl, token)` [154-170]**
- GET request la Google Apps Script proxy
- `url?token=TOKEN` — autentificare cu token
- Proxy returnează: months[] cu totalIncasari, transactions[], annualSubs (COUNT), monthlySubs (COUNT), mrr (pre-calculat)
- Normalizează datele adăugând expenses:{total:0,breakdown:{}}, cashInflows, capitalInflows:0, cashBalance:0

**`computeClientStatus(data)` [171-194]**
- Determină status activ/churn per client pe baza historicului tranzacțiilor

**`computeAudit(data)` [195-261]**
- Calculează 16+ KPI-uri cu formulă, valoare, breakdown, transactions
- KPI-uri: revenue, annualRev, monthlyRev, arr, subscribers, annualSubs, monthlySubs, arpu, cashBalance, burnRate, revenueGrowth, churnRate, managers, expenses, nrr, grr, ebitda, pendingTransfers
- **NRR formula (SaaS standard):** (Beginning MRR + Expansion - Contraction - Churn) / Beginning MRR × 100
- **GRR formula:** (Beginning MRR - Contraction - Churn) / Beginning MRR × 100 (capped la 100%)
- Breakdown detaliat per client: expansion, contraction, churn separate

### Componente UI

**`LoginScreen` [262-300]** — Ecran login cu user/pass

**`CT` (Custom Tooltip) [301-310]** — Tooltip customizat Recharts

**`AuditModal` [311-341]** — Modal care afișează detalii audit KPI (formulă, breakdown, tranzacții)

**`KPI` [342-351]** — Card KPI cu valoare, sufix, change%, subtitle, click → audit

**`Settings` [352-385]** — Panel setări (Script URL, Token, buton connect)

**`OverviewTab` [386-422]**
- KPI-uri: MRR, ARR, Abonați (unique), ARPU, Cash Balance + Runway
- Grafice: Revenue MoM (ComposedChart), MRR trend (AreaChart)
- **Subscriber Mix pie chart** — derivat din `buildSubscriberList` (tA/tM), nu din proxy counts
- **Abonați = buildSubscriberList().length** — source of truth, fiecare client apare O SINGURĂ DATĂ

**`RevenueTab` [423-449]**
- Revenue breakdown: annual vs monthly
- Grafic stacked bar + pie chart

**`SubscribersTab` [450-497]**
- KPI derivate din `buildSubscriberList` (source of truth): Total, Anuali, Lunari
- Fiecare client apare într-o singură categorie bazat pe `currentType` (ultima plată pozitivă)
- Grafic BarChart subscribers/lună, Cumulative AreaChart
- **Cohort Retention** — numără clienți unici (Set.size), nu tranzacții; protecție NaN; color coding (verde ≥50%, galben ≥25%, roșu <25%)
- Include `<SubscriberTable>`

**`buildSubscriberList(data)` [498-560] — SOURCE OF TRUTH**
- Construiește lista completă subscribers din toate tranzacțiile
- Grupează pe client, sortează plățile cronologic
- **Separare plăți pozitive/negative** — storno nu e churn
- `currentType` = tipul ultimei plăți pozitive (annual/monthly) — determină categoria clientului
- `totalNet` = suma tuturor plăților — determină dacă clientul e activ sau churn
- Calculează: expiry (bazat pe ultima plată pozitivă), renewed, renewDate, renewProduct, renewAmount
- **Status logic (5 statusuri, bazat pe totalNet):**
  - `Churn` — totalNet ≤ 0 SAU contract expirat
  - `Upgrade` — monthly → annual (schimbare tip abonament)
  - `Downgrade` — annual → monthly (schimbare tip abonament)
  - `Pending` — daysLeft ≤ 7
  - `Active` — restul
- `renewMonth` — luna + an expirare (ex: "Martie 2027")
- upgradeAmt = suma plătită la upgrade (cash-in real), downgradeAmt similar
- Coloana "Suma reinnoita" eliminată — redundantă
- Export: include `payments[]` array complet și `totalNet` per client

**`SubscriberTable` [562-614]**
- Coloană # (index)
- Search + filter by status
- Status counts header: Active/Pending/Upgrade/Downgrade/Churn
- Badge-uri colorate: bg(green), by(yellow), br(red)
- Coloane: #, Client, Produs, Prima plată, Suma, Expirare, Reînnoit, Data, Produs nou, Upgrade, Downgrade, Churn, Status, Luna reînnoire

**`RenewalsTab` [603-634]**
- KPI: Contracte, Due Luna, Churn Rate, NRR/GRR
- Filtru: 30d / 60d / 90d
- Tabel clienți cu upcoming renewals

**`AuditTab` [635-659]**
- Afișează toate KPI-urile din computeAudit
- Click pe orice → AuditModal cu detalii

**`PLTab` [660-707]**
- Revenue, Cheltuieli, EBITDA
- Breakdown expenses by category
- Grafic MoM (BarChart revenue vs expenses)

**`CashflowTab` [708-735]**
- Cash Balance, Capital Social, Cheltuieli, Runway
- BarChart: intrări vs ieșiri/lună
- **PieChart expenses:** folosește `t.expenseCategory || t.category || 'Necategorizat'`
- Tabel tranzacții bancare (primele 20, non-excluded)

### Upload & Bank Statement (linii 736-855)

**Constante categorii [736-749]**
- `INCOME_TYPES`: Procesator Plăți, Capital Social, Transfer Direct Client, Altele
- `EXPENSE_CATS`: IT, Legal, Operational, Subscriptions, Marketing, HR, Birouri, Advertising, Salarii, Altele
- `AUTO_RULES[]`: regex-uri pentru auto-categorisire (netopia→Procesator, capital→Capital Social, etc.)

**`autoCat(desc, amt)` [749]** — Auto-categorizare pe bază de regex

**`parseCSVLine` [750]** — Parser CSV cu suport ghilimele

**`parseRevolutCSV(content, sourceId)` [751-765]** — Parsează Revolut CSV (coloane: Date completed, Description, Type, Amount)

**`UploadTab` [766-855]**
- Drag & drop CSV upload
- Surse: Google Sheets (default, non-deletable) + CSV-uri uploadate
- Toggle exclude/include tranzacții → `onUpdateBankTx` → parent `data.bankStatement`
- Editare inline: incomeType, expenseCategory (dropdown-uri)
- **Sync din parent:** `useEffect` sincronizează bankTx când data se schimbă

### App Component (linii 856-917)

**State:**
- `auth` — boolean login
- `tab` — tab activ (overview/revenue/subscribers/renewals/audit/pnl/cashflow/upload)
- `data` — datele brute (months, bankStatement, sources)
- `config` — {scriptUrl, token}
- `cs` — connection status (disconnected/loading/connected/error)
- `ar` — auto-refresh boolean
- `showExcl` — toggle "ascunde excluse" din UploadTab (persistat în localStorage)

**Data flow:**
```
raw data → integrateExpenses() → computeRenewals() → enriched
                                                        ↓
                                              toate tab-urile (except Upload)
Upload primește raw data + callbacks onUpdateBankTx/onUpdateSources + showExcluded/setShowExcluded

buildSubscriberList(data) → source of truth pentru:
  - OverviewTab (tS, tA, tM, Subscriber Mix pie chart)
  - SubscribersTab (KPI counts, SubscriberTable)
```

**Persistență:** `localStorage.setItem('microalpha_v10', JSON.stringify({auth,tab,data,config,cs,ar,showExcl}))` — se salvează la orice schimbare de state

**Auto-refresh:** interval 5 min când `ar=true` și `cs='connected'`

**Tabs:** overview, revenue, subscribers, renewals, audit (⚑), pnl, cashflow, upload

## Reguli de lucru
- **NU rescrie de la 0** fără acord explicit
- Fix-uri unul câte unul, doar ce raportează utilizatorul
- Fiecare versiune nouă primește număr incrementat
- Nu începe coding fără acord explicit pe scope
- Validare Babel după fiecare set de modificări

## Istoric versiuni
- **v3** — CSS reference (design funcțional)
- **v6** — Restored din transcript + v3 CSS
- **v7** — +integrateExpenses, +computeRenewals, +enriched pattern, +upload persistence
- **v8** — +Capital Social indicator, +subscriber table complet
- **v9** — 10 fix-uri (unique subs, NRR/GRR SaaS, Cash Balance + Capital Social, localStorage, etc.)
- **v10** — 5 fix-uri:
  1. Subscriber Mix pie chart — label vizibil complet (labelLine=true, outerRadius ajustat)
  2. buildSubscriberList = source of truth — fiecare client apare O SINGURĂ DATĂ, categorizat pe `currentType` (ultima plată pozitivă); OverviewTab + SubscribersTab derivă counts de aici
  3. Cohort Retention — numără clienți unici (Set.size, nu .length tranzacții); protecție NaN pentru ultima cohortă; color coding
  4. Status logic corect — storno nu e churn; totalNet > 0 = activ; upgrade/downgrade bazat pe prima vs ultima plată pozitivă; rezolvat cazuri Burlacu/Gordan/Kolesa/Teodoroiu
  5. showExcluded persistă între tab switches — mutat din UploadTab local state în App state + localStorage
