/**
 * Synthetic sample messages for `taskpane.html?demo=<name>`, used for the
 * website, Store screenshots and manual UI testing outside Outlook. They use
 * reserved example domains (RFC 2606) and documentation IPs (RFC 5737).
 */
import type { AnalysisContext } from '../parser/analyze';
import type { PolicyInfo } from '../parser/policy';

export interface DemoSample {
  headers: string;
  ctx?: AnalysisContext;
  /** Policy the fake DNS lookup returns in demo mode. */
  dnsPolicy?: PolicyInfo;
}

export const DEMOS: Record<string, DemoSample> = {
  verified: {
    headers: `Authentication-Results: mx.google.com;
       dkim=pass header.i=@example.com header.s=s1;
       spf=pass (google.com: domain of bounce@example.com designates 192.0.2.10 as permitted sender) smtp.mailfrom=bounce@example.com;
       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=example.com
Received: from mail.example.com (mail.example.com. [192.0.2.10]) by mx.google.com
From: Example Bank <service@example.com>
To: you@example.net
Subject: Your statement is ready
`,
  },
  authenticated: {
    headers: `Authentication-Results: spf=pass (sender IP is 192.0.2.25)
 smtp.mailfrom=mail.example.org; dkim=pass (signature was verified)
 header.d=example.org;dmarc=pass action=none
 header.from=example.org;compauth=pass reason=100
Received: from mail.example.org (192.0.2.25) by EXAMPLE.mail.protection.outlook.com
From: Example Shop <orders@example.org>
To: you@contoso.example
Subject: Order confirmation
`,
    dnsPolicy: { p: 'quarantine', source: 'dns', resolver: 'Quad9', recordDomain: 'example.org' },
  },
  arc: {
    headers: `Authentication-Results: mx.google.com;
       dkim=pass header.i=@lists.example.org header.s=list;
       arc=pass (i=1 spf=pass spfdomain=example.com dkim=pass dkdomain=example.com dmarc=pass fromdomain=example.com);
       spf=pass smtp.mailfrom=dev-bounces@lists.example.org;
       dmarc=fail (p=REJECT sp=REJECT dis=NONE) header.from=example.com
Received: from mail.lists.example.org (198.51.100.7) by mx.google.com
ARC-Seal: i=1; a=rsa-sha256; cv=none; d=lists.example.org; s=arc1; b=c2VhbA==
ARC-Message-Signature: i=1; a=rsa-sha256; d=lists.example.org; s=arc1; h=from; bh=Ym9keQ==; b=YW1z
ARC-Authentication-Results: i=1; lists.example.org;
       dkim=pass header.d=example.com; spf=pass smtp.mailfrom=alice@example.com;
       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=example.com
From: Alice <alice@example.com>
To: dev@lists.example.org
Subject: [dev] Release notes
`,
  },
  unprotected: {
    headers: `Authentication-Results: spf=fail (sender IP is 203.0.113.66)
 smtp.mailfrom=bank.example; dkim=none (message not signed)
 header.d=none;dmarc=fail action=oreject
 header.from=bank.example;compauth=fail reason=000
Received: from evil.example (203.0.113.66) by EXAMPLE.mail.protection.outlook.com
From: Bank Security <security@bank.example>
Reply-To: <help@evil.example>
To: you@contoso.example
Subject: Verify your account now
`,
  },
  lookalike: {
    headers: `Authentication-Results: mx.google.com;
       dkim=pass header.i=@xn--pypal-4ve.com;
       spf=pass smtp.mailfrom=xn--pypal-4ve.com;
       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=xn--pypal-4ve.com
Received: from mail.xn--pypal-4ve.com by mx.google.com
From: PayPal <service@xn--pypal-4ve.com>
To: you@example.net
Subject: Your account is limited
`,
  },
  internal: {
    headers: `Received: from AM9PR01MB1234.eurprd01.prod.exchangelabs.com by AS8PR01MB5678.eurprd01.prod.exchangelabs.com with HTTPS
From: Anna Colleague <anna@contoso.example>
To: you@contoso.example
Subject: Lunch?
X-MS-Exchange-Organization-AuthSource: AM9PR01MB1234.eurprd01.prod.exchangelabs.com
X-MS-Exchange-Organization-AuthAs: Internal
`,
  },
};
