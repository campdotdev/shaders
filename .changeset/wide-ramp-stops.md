---
'@lovo/matter': minor
---

colorRamp stops can now be node-driven: `position` accepts `number | TSLNode` and node-valued `color` is a pinned-down part of the contract, so uniforms can drive ramp colors and positions live with no material rebuild (stop count stays structural). Literal-position ramps compile exactly as before. Node-driven segments use an epsilon-floored span, so coincident stops render a hard step. The `colorSpaces` conversion registry (fromLinear/toLinear per supported space) is now exported.
