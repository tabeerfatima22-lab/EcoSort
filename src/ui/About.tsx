import measured from "../measured.json";
import type { Engine } from "../app/engine";

const p = (v: number | null | undefined) => (v === null || v === undefined ? "n/a" : `${(100 * v).toFixed(1)}%`);

export function About({ engine }: { engine: Engine | null }) {
  const s = measured.heldout.strict;
  const b = measured.heldout.balanced;
  return (
    <section className="page">
      <h1>How EcoSort AI decides, and how well it works</h1>
      <p>
        EcoSort runs two pretrained neural networks inside your browser. Nothing was trained for this app and no picture leaves your device.
      </p>

      <h2>The models</h2>
      <ul>
        <li>
          <b>Material model</b> ({engine ? `${engine.meta.model_name} ${engine.meta.model_version}` : measured.wasteModel}): a MobileNetV2 network fine-tuned by its author on
          TrashNet, RealWaste and a public garbage dataset. It sorts a picture into cardboard, glass, metal, paper, plastic or trash.
        </li>
        <li>
          <b>Object model</b>: MobileNetV2 trained on ImageNet (1,000 everyday objects). It names the object when it can, and stops a
          recommendation when the item looks like electronics, a medical item, food or clothing.
        </li>
      </ul>

      <h2>When it recommends a bin</h2>
      <ul>
        <li>The picture is analysed four ways (whole, mirrored, and two closer crops). All four must point to the same bin.</li>
        <li>The averaged probability for that bin must be at least 80% in Balanced mode (the default) or 95% in Strict mode.</li>
        <li>The object model must not contradict the material or flag an item the four bins are not meant for.</li>
        <li>If any check fails, the answer is Uncertain. A camera cannot see food residue reliably, so the app asks you whether the item is clean.</li>
      </ul>

      <h2>Teaching it your own items</h2>
      <p>
        After any scan you can press <b>Tell EcoSort what this is</b> and choose the bin. The app stores the picture's features (1,280 numbers from
        the object model) and compares later scans with them. When a scan is at least 82% similar to a tagged photo, your bin is used. No model is
        retrained and nothing is uploaded.
      </p>
      <p>
        Measured on altered copies of 198 test pictures, a re-photographed item was found {p(measured.teach?.sameItemFound)} of the time, never
        matched to a different item, and a never-tagged item was wrongly matched {p(measured.teach?.falseMatch)} of the time. It recognises the
        same or a very similar item; it does not learn a whole category from one example.
      </p>

      <h2>Measured results</h2>
      <p>
        Measured on {s.pictures} pictures from the TrashBox dataset that the model was not trained on ({s.inScope} items for the four bins,
        {" "}{s.outOfScope} electronics, medical and scrap items, {s.dependsOnLocalRules} not scored). Report generated {measured.generated}.
      </p>
      <div className="scroll">
        <table className="table">
          <thead>
            <tr><th>Measure</th><th>Strict</th><th>Balanced</th></tr>
          </thead>
          <tbody>
            <tr><td>Gave a bin</td><td>{p(s.answered)}</td><td>{p(b.answered)}</td></tr>
            <tr><td>Correct when it gave a bin</td><td>{p(s.accuracyWhenAnswered)}</td><td>{p(b.accuracyWhenAnswered)}</td></tr>
            <tr><td>Wrong bin, as a share of all items</td><td>{p(s.wrongBinOfAll)}</td><td>{p(b.wrongBinOfAll)}</td></tr>
            <tr><td>Electronics, medical and scrap items held back</td><td>{p(s.outOfScopeHeldBack)}</td><td>{p(b.outOfScopeHeldBack)}</td></tr>
            <tr><td>Right bin with all checks switched off</td><td colSpan={2}>{p(s.forcedBinAccuracy)}</td></tr>
          </tbody>
        </table>
      </div>
      <p>
        The model's author reports {p(measured.authorReported.testAccuracy)} on their own test pictures. On independent pictures it is clearly
        lower, which is why EcoSort answers Uncertain so often instead of guessing. Results with your camera and your items will differ:
        use the Experiment tab to measure them.
      </p>

      <h2>Limits you should know</h2>
      <ul>
        <li>It recognises material from appearance. Clear plastic and glass, and paper and cardboard, are the pairs it confuses most.</li>
        <li>It only knows six materials. Batteries, electronics, food, textiles and medical waste are outside its training.</li>
        <li>The confidence figure is the model's own probability and is not calibrated. Wrong answers can also show high confidence.</li>
        <li>It analyses one item at a time. Several items in view usually leads to Uncertain.</li>
        <li>Recycling rules differ between sites. The bin names and instructions are general; follow your local signs.</li>
      </ul>

      <h2>Cameras</h2>
      <ul>
        <li>Phone or laptop camera: works in the browser over https. This is the supported way to use EcoSort.</li>
        <li>
          Network cameras: EcoSort can read a still picture from a snapshot address (Settings). The camera, or a bridge such as go2rtc, must
          offer an https snapshot address that allows this page to read it.
        </li>
        <li>
          Xiaomi Smart Camera C200: it works through the Mi Home app and does not offer a standard local stream on all firmware, so EcoSort
          cannot connect to it directly. A spare phone on a stand running EcoSort is the reliable fixed-camera setup.
        </li>
      </ul>

      <h2>Credits</h2>
      <ul>
        <li>Material model: SmartWaste by anniesrdnl (github.com/anniesrdnl/Smart-Waste-Classifier).</li>
        <li>Object model: MobileNetV2-12, ONNX Model Zoo (Apache-2.0).</li>
        <li>Datasets behind the material model: TrashNet, RealWaste (CC BY 4.0), Garbage Dataset (MIT). Test set: TrashBox.</li>
        <li>Inference: ONNX Runtime Web (MIT).</li>
      </ul>
    </section>
  );
}
