"""Same-item test: each of 198 pictures is 'taught' once (original photo, tagged with its bin)
and then queried with 3 altered versions of itself. All other 197 items are taught too,
so the query must pick its own item out of 198. Also: unknown items = query a picture
whose own original was NOT taught (leave-one-out) -> should not match."""
import json, numpy as np, collections
BIN={"cardboard":"paper","glass":"other","metal":"other","paper":"paper","plastic":"plastic"}
rows=[json.loads(l) for l in open("aug.jsonl")]
def n(v): v=np.asarray(v,np.float32); return v/(np.linalg.norm(v)+1e-9)
def emb(x,kind):
    if kind=="obj": return n(x["o"])
    if kind=="waste": return n(x["w"])
    return n(np.concatenate([n(x["o"]),n(x["w"])]))
for kind in ("obj","waste","both"):
    E=np.stack([emb(r["orig"],kind) for r in rows])
    for T in (0.6,0.7,0.75,0.8,0.85,0.9):
        c=collections.Counter()
        for i,r in enumerate(rows):
            for v in ("reframe","dark","turned"):
                s=E@emb(r[v],kind)
                # known: own item taught
                j=int(np.argmax(s)); s_sorted=np.sort(s)[::-1]
                if s[j]>=T: c["k_match"]+=1; c["k_right"]+= j==i
                c["k"]+=1
                # unknown: own item removed
                s2=s.copy(); s2[i]=-1; j2=int(np.argmax(s2))
                c["u"]+=1; c["u_false"]+= s2[j2]>=T
        print(f"{kind:5} T={T:.2f}: same item found {c['k_right']/c['k']:.3f}  wrong item {(c['k_match']-c['k_right'])/c['k']:.3f} | never-taught item falsely matched {c['u_false']/c['u']:.3f}")
