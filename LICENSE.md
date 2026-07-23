Relex Business Source License
=============================

Version 1.0 — Effective 2026-07-24
Copyright (c) 2026 Mahesh Shantaram

This is a source-available license intended to allow you to read, learn from,
and modify the Relex codebase for your own internal use, while *prohibiting*
you from operating Relex as a competing paid service or distributing it as a
general-purpose product without a separate commercial agreement.

Relex is a single-codebase, multi-tenant application: one shared core engine
is deployed separately per client, each pointed at that client's own data
source. This license covers the core engine and all shared application logic.
Per-client tenant configuration files (under `tenants/`) are not subject to
redistribution restrictions — they are configuration, not code.

This is **not** legal advice. If you require legal certainty, consult a
qualified lawyer in your jurisdiction.

1. Definitions
--------------

- **Software** means the Relex codebase and all files in this repository,
  including modifications and derivative works you create based on it. This
  includes the shared core engine under `src/`, the build configuration
  (`vite.config.ts`), and all shared components, hooks, and libraries.

- **Tenant Configuration** means per-client configuration files under
  `tenants/{slug}/tenant.config.json` — branding, data source paths, and
  schema mappings. These are data files, not executable code.

- **Licensor** means the copyright holder, Mahesh Shantaram.

- **You** (or **Your**) means any individual or legal entity exercising
  permissions granted by this license.

- **Production Use** means using the Software, or making it available for use,
  in any way that provides value to third parties beyond yourself or your own
  organization (for example: running it on a server for others to access,
  embedding it in a product, or offering it as a service).

- **Competing Service** means any hosted or distributed software whose primary
  purpose is substantially similar to that of Relex: visualizing people,
  organizations, and their relationships (such as faculty, projects,
  collaborations, platforms, research verticals, or similar entities) for
  institutions or clients.

- **Non-Commercial Use** means use that is not intended to generate direct or
  indirect revenue, consideration, or commercial advantage. Academic research,
  personal learning, and internal experiments within an organization generally
  qualify as Non-Commercial Use.

2. Grant of Rights
|------------------

Subject to the terms and conditions of this license, Licensor grants You a
non-exclusive, worldwide, non-transferable, revocable license to:

- **View and study** the Software.
- **Modify** the Software for your own purposes.
- **Use** the Software for Non-Commercial Use within your own organization.

You may run the Software internally (for yourself or within your organization)
for evaluation, experimentation, research, or internal reporting without
paying a fee to the Licensor, provided that such use is Non-Commercial and not
a Competing Service.

3. Restrictions
---------------

Except as expressly permitted above, You **may not**:

1. Offer the Software, or any modified version of it, as a hosted or managed
   service to third parties without a separate written agreement with Licensor.

2. Sell, license, sublicense, rent, lease, or otherwise commercially exploit
   the Software as a product or service, including as part of a consulting,
   SaaS, or analytics offering, without a separate written agreement with
   Licensor.

3. Use the Software to operate any **Competing Service**, whether paid or
   unpaid, without a separate written agreement with Licensor.

4. Redistribute the Software, or substantial portions of it, in source or
   binary form to third parties, except:
   - as part of an academic paper, blog post, portfolio, or similar work
     where small excerpts of code are quoted for illustrative purposes; or
   - as explicitly permitted in writing by Licensor.

5. Remove or alter any copyright notices, license notices, or attribution to
   the Licensor in the Software.

Any attempt to circumvent these restrictions (for example by providing
"deployment scripts" that cause others to host the Software for third parties)
is considered a violation of this license.

4. Multi-Tenant Deployment Model
|--------------------------------|

Relex is architected as a single codebase with per-client tenant configuration.
The core engine (`src/`) is shared across all deployments. Each tenant gets:

- Its own `tenants/{slug}/tenant.config.json` specifying branding, data source,
  and schema mapping.
- Its own build output (`dist/{slug}/`) produced by `TENANT={slug} bun run build`.
- Its own deployment (e.g. separate Cloudflare Pages project, subdomain, or
  intranet path).

The deployed static bundle never proxies or stores tenant data. Each tenant's
browser fetches their own workbook directly from their own data source URL.
If a client's data source requires an API key header, the key is supplied and
used entirely client-side (held in browser memory/sessionStorage on the client's
own network, never sent to any server controlled by the Licensor).

5. Contributions
|----------------

If You submit changes, pull requests, or other contributions to the Software,
You agree that Licensor may use, modify, and incorporate those contributions
into the Software and any commercial versions of it without additional
obligation to You, unless a separate written agreement states otherwise.

You are not required to submit any modifications You make; this license does
not obligate You to contribute code back.

6. No Warranty
--------------

THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN
NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM,
OUT OF, OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

7. Limitation of Liability
|--------------------------

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LICENSOR SHALL NOT BE
LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
DAMAGES, OR ANY LOSS OF PROFITS OR REVENUE, WHETHER INCURRED DIRECTLY OR
INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES,
RESULTING FROM YOUR USE OF OR INABILITY TO USE THE SOFTWARE.

8. Term and Termination
|-----------------------|

This license is effective from the date You first access or use the Software
and continues until terminated.

Licensor may terminate this license immediately if You violate any of its
terms. Upon termination, You must stop using the Software and destroy any
copies in Your possession or control. Termination does not limit any of
Licensor's rights or remedies at law or in equity.

9. Commercial Licensing
|-----------------------|

If You wish to:

- offer the Software as a hosted or managed service,
- integrate it into a commercial product,
- use it to provide paid services to clients, or
- operate it as part of any Competing Service,

You must obtain a separate commercial license from the Licensor.

To inquire about commercial licensing, contact:

> Mahesh Shantaram
> Email: (add preferred contact)

10. Governing Law
|----------------

This license shall be governed by and construed in accordance with the laws of
India, without regard to its conflict-of-law principles, unless otherwise
required by applicable law.

---

By using, copying, or modifying the Software, You acknowledge that You have
read, understood, and agree to be bound by the terms of this license.
