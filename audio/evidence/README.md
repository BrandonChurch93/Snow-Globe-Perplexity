# Evidence: the sound tool is out of credits

Read by the sound agent of Phase 4 on 2026-11-25 (UTC). No key or token is in these files: every call went through the credential proxy, which adds the key outside this workspace.

| File | What it is |
| --- | --- |
| `subscription-2026-11-25T0251Z.json` | `GET /v1/user/subscription`, read at 02:51:42. The answer was printed at the time through `python3 -m json.tool` and not saved raw. This file is the answer of 02:55:12 passed through the same formatter; every field printed at 02:51:42 has the same value in it, the counter included |
| `subscription-2026-11-25T0255Z.json` | The same call at 02:55:12, the raw answer. Between the two reads lie the refused take (02:52:33) and the composition plan call (02:54): the counter did not move, so the plan call cost nothing |
| `quota-401-shake-spring-2026-11-25T0252Z.json` | The first take of Phase 4, `shake-spring`: the request as sent and the answer, HTTP 401 `quota_exceeded` |
| `quota-401-music-spring-2026-11-25T0258Z.json` | The music endpoint asked once, with the first take of `music-spring`: HTTP 401 `insufficient_credits`. The counter read 130996 before and after |
| `plan-call-2026-11-25T0254Z.json` | The composition plan call for `one-piece`: the request, the status and the answer's headers. The plan itself is `audio/plans/one-piece.json` |

What they say: tier `creator`, 130996 of 131000 credits used, 4 left, `can_extend_character_limit` false, the period resets at 1798056524 (2026-12-23 20:08:44 UTC). A sound effect of 0.5 s, the shortest the endpoint makes, costs 6.

The two `subscription-*.json` files were reduced by the Builder before they reached `main`: they hold only the counter fields of the answer (tier, the two counts, whether the limit can be extended, the reset time, the status). The answer's billing fields are left out of a public repo.
