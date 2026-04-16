# Project Knowledge Base

## Trading Day Definition (NQ/MNQ Futures)

The "trading day" for NQ/MNQ follows CME Globex hours, expressed in HKT (UTC+8):

| Boundary | HKT   | UTC          | ET (EDT)  |
|----------|-------|--------------|-----------|
| Open     | 06:00 | 22:00 prev   | 18:00     |
| Close    | 05:00 | 21:00        | 17:00     |
| Break    | 05:00–06:00 HKT (CME maintenance) | | |

**Session date rule**: a trade's "trading day" is identified by the HKT calendar date on which the session *ends* (i.e. the date at 05:00 HKT).

- Trade at HKT hour **< 06:00** → session started the *previous* calendar day at 06:00 HKT  
  e.g. Apr 10 00:50 HKT → trading day = Apr 9 06:00 HKT → Apr 10 05:00 HKT
- Trade at HKT hour **≥ 06:00** → session started *today* at 06:00 HKT  
  e.g. Apr 10 12:00 HKT → trading day = Apr 10 06:00 HKT → Apr 11 05:00 HKT

Implementation: `lib/analytics/loadDayCandles.ts`

### Chart Session Windows

Sessions displayed in `CandleChart.tsx` (UTC hours, HKT label):

| Session | UTC Hours | HKT |
|---------|-----------|-----|
| Asia    | 00:00–08:00 | 08:00–16:00 HKT |
| London  | 08:00–13:30 | 16:00–21:30 HKT |
| NY      | 13:30–21:00 | 21:30–05:00 HKT |

The NY session end (21:00 UTC) coincides with the CME close and the last candle of the day. `timeToCoordinate()` in lightweight-charts returns `null` for timestamps outside the data range, so the draw end must be clamped to `lastCandle` (not `lastCandle + 60`) to prevent the NY fill from being silently dropped.
