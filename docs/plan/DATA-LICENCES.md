# Data licences - the V-09 verification (P2.2, R-DATA-08)

Every row below was read by the lane, on the publisher's own licence or terms
page, on 2026-11-05, and quoted verbatim. Nothing here is inferred from a
summary, a secondary source, or another row.

This file exists because V-09 decides something practical: which of these
sources a permanently free, non-commercial site may **embed** - redistribute the
values inside its own pages and derived datasets - and which it may only link
to. The answer is not uniform, and one source is prohibited.

## Summary

| Source                | Licence as the page states it                                    | Embed                                          | Derive                | Condition                                                                             |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Ember                 | Creative Commons Attribution Licence (CC-BY-4.0)                 | Yes                                            | Yes                   | Credit Ember; logo needs permission                                                   |
| GlobalPetrolPrices    | Creative Commons Attribution-NonCommercial-NoDerivs 3.0 Unported | **No**, and its own terms add explicit consent | **No** (NoDerivs)     | Written consent required to distribute                                                |
| Eurostat              | Reuse authorised under Decision 2011/833/EU; no named CC licence | Yes                                            | Yes                   | Acknowledge Eurostat; state any adaptation explicitly                                 |
| US EIA                | US Government public domain, not subject to copyright            | Yes                                            | Yes                   | Acknowledge with the publication date; excludes third-party material and the EIA logo |
| OpenEI / URDB         | Creative Commons Attribution 4.0 (CC BY 4.0)                     | Yes                                            | Yes                   | Attribution; cite the dataset                                                         |
| European Central Bank | Free use under stated conditions; no named licence               | Yes                                            | Ambiguous - see below | Cite the ECB; state modifications; never frame the site                               |

**The decision this forces:** GlobalPetrolPrices must not be embedded, and no
value may be derived from it. It was planning research's candidate for fuel and
retail price series; it cannot be that. If such a series is ever genuinely
needed, the path is a written request to the publisher and a recorded answer in
this file - not a judgement call at the point of use.

## The evidence, per source

### Ember

Read at <https://ember-energy.org/creative-commons/>:

> Ember content is released under a Creative Commons Attribution Licence
> (CC-BY-4.0). This means you're free to share and adapt our work - as long as
> you credit us. If you would like to use our logo, we ask that you request
> permission.

The site footer repeats it: "All content is released under a Creative Commons
Attribution Licence (CC-BY-4.0)." Commercial use is not restricted, so the
non-commercial nature of this site is not load-bearing here; the obligation is
attribution, and the logo is excluded from the grant.

### GlobalPetrolPrices

Read at <https://www.globalpetrolprices.com/terms_conditions.php>:

> www.GlobalPetrolPrices.com is licensed under a Creative Commons
> Attribution-NonCommercial-NoDerivs 3.0 Unported License

and, on the same page, under Data Provision:

> No third-party provider is authorized to distribute or sell our data without
> explicit consent from us.

NoDerivs forbids adapted material, which is what a chart, a rebased series or a
merged price table would be, and the second sentence adds a distribution
restriction on top of the CC grant. The site being free and non-commercial does
not rescue the NoDerivs term. This source is therefore **not embeddable**, and
the plan's earlier note that it was "CC BY-NC-ND 3.0 per planning research, so
not embeddable" is now confirmed at the source rather than carried as planning
lore.

### Eurostat

Read at
<https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Copyright/licence_policy>:

> Reuse is authorised provided the source is acknowledged. The reuse policy of
> European Commission documents is regulated by Decision 2011/833/EU (OJ L 330,
> 14.12.2011, p. 39).

> Except where otherwise stated, downloading and reproduction of Eurostat
> data/documents for personal use or for further non-commercial or commercial
> dissemination are authorised provided appropriate acknowledgement is given to
> Eurostat as the source, and subject to the exceptions/conditions hereinafter
> specified.

> When data/documents are adapted or modified by the user, this shall be
> explicitly stated at a suitably prominent place on his work.

The listed exclusions are for material originating outside Eurostat, non-EU/EFTA
geography, certain EFTA trade series, logos, and documents bearing a restrictive
notice. Household electricity prices (nrg_pc_204) are Eurostat's own collection
about EU member states, so they fall inside the general grant - with the
adaptation statement required, which matters here because this project converts
prices into other currencies.

### US EIA

Read at <https://www.eia.gov/about/copyrights_reuse.php>:

> U.S. government publications are in the public domain and are not subject to
> copyright protection. You may use and/or distribute any of our data, files,
> databases, reports, graphs, charts, and other information products that are on
> our website or that you receive through our email distribution service.

> However, if you use or reproduce any of our information products, you should
> use an acknowledgment, which includes the publication date, such as: "Source:
> U.S. Energy Information Administration (Oct 2008)."

The page also excludes privately contributed material that may be protected, and
the EIA logo is a registered trademark. The registry already carries this source
as US Government public domain; the acknowledgement-with-date form is the part
worth applying to rendered figures.

### OpenEI / URDB

Read at <https://data.openei.org/submissions/5>:

> License CC

with the badge linking to <https://creativecommons.org/licenses/by/4.0/>, and
the page footer:

> Content is available under Creative Commons Attribution 4.0 unless otherwise
> noted.

The licence is displayed as a badge plus a site-wide default rather than a
prose sentence about this dataset specifically; both point to CC BY 4.0, so the
reading is consistent but its form is weaker than a written statement. The
record's citation (Zimny-Schmitt, D. and Huggins, J., NREL, 2010) is what
attribution should reproduce.

### European Central Bank

Read at <https://www.ecb.europa.eu/services/disclaimer/html/index.en.html>:

> Subject to the exception below, users of this website may make free use of the
> information obtained directly from it subject to the following conditions:
>
> 1. When such information is distributed or reproduced, it must appear
>    accurately and the ECB must be cited as the source. [...] 3. If the
>    information is modified by the user (e.g. by seasonal adjustment of
>    statistical data or calculation of growth rates) this must be stated
>    explicitly. 4. When linking to this website from business sites or for
>    promotional purposes, this website must load into the browser's entire
>    window (i.e. it must not appear within another website's frame).

Free use, with citation, is clear. Whether a _modified_ series may be
republished is **not** clear from this page alone: it permits modification if
stated, while the ESCB statistics reuse policy is understood to require
statistics to be used unmodified and in standard format. That second page was
not read in this pass, so the honest position is: embed the reference rates
unmodified with "Source: ECB", state any transformation applied in this
project, and do not frame ECB pages.

## What this pass did not establish

- Eurostat's **dataset-level** notice for nrg_pc_204 was not read; only the
  policy page that governs Eurostat material generally.
- The ECB's **ESCB statistics reuse policy** page was not read, so the
  modification question above is recorded as ambiguous rather than resolved.
- Ember's statement is site-wide; a price-dataset-specific licence line was not
  separately read.
- No permission has been sought from GlobalPetrolPrices. Until one exists in
  writing and is recorded here, its data stays out of the site.

## Consequence for the plan

- P2.x may embed Ember, Eurostat, EIA and URDB values, with the attribution each
  row requires, and must state adaptations (currency conversion, rebasing).
- P2.x may embed ECB reference rates unmodified with citation.
- P2.x must not embed or derive from GlobalPetrolPrices. Any plan line that
  assumed otherwise is now wrong and should be corrected where it appears.

## The runtime FX source and the ECB's coverage (V-07)

Read in this pass at the provider's own docs page, because the source's terms
had never been read and one of them creates an obligation the site now meets.

### ExchangeRate-API, Open Access endpoint (`open.er-api.com`)

Read at <https://www.exchangerate-api.com/docs/free>:

> This open access API is subject to our Terms and requires attribution. You're
> welcome to cache the data we respond with and to use it for either personal or
> commercial currency conversion purposes. You are, however, not allowed to
> re-distribute it.

and, in the endpoint comparison:

> **Open API** - No API Key - Attribution Required - Updates Once Per Day - Rate
> Limited

with the required form:

> ```
> <a href="https://www.exchangerate-api.com">Rates By Exchange Rate API</a>
> ```

The page also notes a 429 response that clears after 20 minutes, and a
`time_eol` field the endpoint will populate if it is ever deprecated.

Three consequences, all of them now implemented or recorded:

1. **Attribution is required, and the page carries it.** A link with the
   provider's exact required text sits directly under the rate line on the
   calculator page, so it appears wherever those rates are used. The link is not
   translated, because it is a brand string the terms specify.
2. **Redistribution is not permitted, and nothing ships the rates.** The map and
   calculator fetch live; the provider's payload is never written into shipped
   data. Whether the built-in fallback table is itself a copy of that payload was
   **not** audited in this pass, so it is carried as an open assumption (A-19) with
   a verify-by date rather than asserted clean.
3. **Once-a-day refresh bounds freshness.** A live rate can be up to 24 hours
   old; the page's staleness badge (P1.4) is what stops that from becoming a
   silent claim of currency.

### The ECB reference rates, and why they are not a substitute

Read at
<https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html>:

> They are based on the daily concertation procedure between central banks
> across Europe, which normally takes place around 14:10 CET. The reference
> rates are published for information purposes only.

> Owing to current trading activity in the EUR/RUB market, the European Central
> Bank (ECB) is not in a position to set a reference rate that is
> representative of prevailing market conditions. The ECB has therefore decided
> to suspend its publication of a euro reference rate for the Russian rouble
> until further notice.

Coverage is a curated list of roughly thirty currencies quoted against the euro
(JPY, CZK, DKK, SEK, CHF, TRY, BRL, CAD, NZD, SGD, THB and their peers), against
the **153** currencies this site converts. So the ECB is a citable reference for
licensing purposes - it may be embedded with "Source: ECB" - but it cannot stand
in for the runtime source: it is EUR-based, covers about a fifth of the
currencies, is published for information rather than transactions, and has no
rouble since 2022-03-01. That comparison is recorded in the `fx_live`
disclosure so a future change to the FX source starts from it rather than
rediscovering it.
