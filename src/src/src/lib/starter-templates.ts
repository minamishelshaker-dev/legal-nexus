export type Starter = { name: string; description: string; contract_type: string; language: "ar" | "en"; body: string };
export type StarterClause = { title: string; category: string; language: "ar" | "en"; body: string };

const REVIEW_AR = "نموذج إرشادي عام. يجب مراجعته وتعديله من محامٍ مختص قبل اعتماده واستعماله.";
const REVIEW_EN = "General guidance template. Must be reviewed and adapted by a qualified lawyer before approval and use.";

export const STARTER_TEMPLATES: Starter[] = [
  {
    name: "اتفاقية سرية متبادلة (NDA)",
    description: REVIEW_AR,
    contract_type: "nda",
    language: "ar",
    body: `اتفاقية سرية متبادلة

تم إبرام هذه الاتفاقية بتاريخ {{effective_date}} بين:

1) {{party_a}} (ويُشار إليه بـ "الطرف الأول").
2) {{party_b}} (ويُشار إليه بـ "الطرف الثاني").

تمهيد
يرغب الطرفان في تبادل معلومات سرية لغرض {{purpose}}، ولذلك اتفقا على ما يلي:

المادة (1) تعريف المعلومات السرية
يقصد بالمعلومات السرية كل ما يفصح عنه أحد الطرفين للآخر من بيانات أو مستندات أو خطط أو معلومات فنية أو تجارية، سواء كانت كتابية أو شفهية أو إلكترونية، والتي تُعدّ سرية بطبيعتها أو تُصنف كذلك عند الإفصاح.

المادة (2) التزام السرية
يلتزم كل طرف بالحفاظ على سرية المعلومات التي يتلقاها، وعدم استخدامها إلا للغرض المذكور في التمهيد، وعدم الإفصاح عنها لأي طرف ثالث إلا بموافقة كتابية مسبقة، وحصر الاطلاع عليها في من تقتضي حاجته إلى ذلك من العاملين والمستشارين الملتزمين بالسرية.

المادة (3) الاستثناءات
لا تسري أحكام هذه الاتفاقية على معلومات كانت متاحة للعموم دون خطأ من الطرف المتلقي، أو كانت في حوزته مسبقاً بصورة مشروعة، أو طُلب الإفصاح عنها بموجب قانون أو حكم قضائي مع إخطار الطرف الآخر فوراً وقدر الإمكان.

المادة (4) المدة
تسري هذه الاتفاقية لمدة {{term_years}} سنة من تاريخ إبرامها، وتظل التزامات السرية قائمة لمدة {{survival_years}} سنة بعد انتهائها.

المادة (5) رد المعلومات وإتلافها
على الطرف المتلقي، بناءً على طلب كتابي من الطرف المفصح، أن يعيد أو يتلف كافة المعلومات السرية ونسخها خلال مدة معقولة، مع إخطار كتابي بذلك.

المادة (6) القانون الواجب التطبيق والاختصاص
يخضع هذا الاتفاق لـ {{governing_law}}، وتختص {{court}} بالنظر في أي نزاع ينشأ عنه.

المادة (7) أحكام عامة
هذه الاتفاقية تمثل الاتفاق الكامل بين الطرفين بشأن موضوعها، ولا يجوز تعديلها إلا بملحق كتابي موقّع من الطرفين.

التوقيعات
الطرف الأول: {{party_a}}
الاسم والصفة: ____________________  التوقيع: ____________________

الطرف الثاني: {{party_b}}
الاسم والصفة: ____________________  التوقيع: ____________________
`,
  },
  {
    name: "Mutual Non-Disclosure Agreement (NDA)",
    description: REVIEW_EN,
    contract_type: "nda",
    language: "en",
    body: `MUTUAL NON-DISCLOSURE AGREEMENT

This Agreement is made on {{effective_date}} between:

1) {{party_a}} ("Party A"); and
2) {{party_b}} ("Party B").

Background
The parties wish to exchange confidential information for the purpose of {{purpose}} and agree as follows:

1. Confidential Information
"Confidential Information" means all information disclosed by one party to the other, in any form, that is marked confidential or would reasonably be understood to be confidential.

2. Obligations
Each party shall keep the other party's Confidential Information confidential, use it only for the stated purpose, not disclose it to any third party without prior written consent, and limit access to personnel and advisers who need to know and are bound by confidentiality obligations.

3. Exceptions
These obligations do not apply to information that is publicly available through no fault of the recipient, was lawfully known to the recipient beforehand, or is required to be disclosed by law or court order (in which case the recipient shall notify the disclosing party promptly where permitted).

4. Term
This Agreement remains in force for {{term_years}} years from the date above. Confidentiality obligations survive for {{survival_years}} years after expiry or termination.

5. Return or Destruction
On written request, the recipient shall promptly return or destroy all Confidential Information and copies, and confirm in writing that it has done so.

6. Governing Law and Jurisdiction
This Agreement is governed by {{governing_law}}, and the {{court}} shall have jurisdiction over any dispute arising from it.

7. General
This Agreement is the entire agreement between the parties on its subject matter and may only be amended in writing signed by both parties.

SIGNATURES
Party A: {{party_a}}
Name and title: ____________________  Signature: ____________________

Party B: {{party_b}}
Name and title: ____________________  Signature: ____________________
`,
  },
];

export const STARTER_CLAUSES: StarterClause[] = [
  { title: "السرية", category: "confidentiality", language: "ar", body: "يلتزم كل طرف بالحفاظ على سرية كافة المعلومات التي يحصل عليها من الطرف الآخر بمناسبة تنفيذ هذا العقد، وعدم الإفصاح عنها للغير إلا بموافقة كتابية مسبقة، وتستمر هذه الالتزامات بعد انتهاء العقد." },
  { title: "Confidentiality", category: "confidentiality", language: "en", body: "Each party shall keep confidential all information received from the other party in connection with this Agreement, shall not disclose it to any third party without prior written consent, and these obligations shall survive termination or expiry of this Agreement." },
  { title: "القوة القاهرة", category: "force_majeure", language: "ar", body: "لا يعد أي طرف مخلاً بالتزاماته إذا تعذّر أو تأخر التنفيذ نتيجة قوة قاهرة لا يمكن توقعها أو دفعها، شريطة أن يخطر الطرف المتضرر الطرف الآخر كتابياً فور وقوعها، وأن يبذل كل جهد معقول للتخفيف من أثرها." },
  { title: "Force majeure", category: "force_majeure", language: "en", body: "Neither party shall be in breach of this Agreement for any failure or delay in performance caused by events beyond its reasonable control that could not have been foreseen or prevented, provided it promptly notifies the other party in writing and uses reasonable efforts to mitigate the effects." },
  { title: "الإنهاء", category: "termination", language: "ar", body: "يجوز لأي من الطرفين إنهاء هذا العقد بإخطار كتابي مسبق مدته {{notice_days}} يوماً، وللطرف غير المخل إنهاؤه فوراً إذا أخلّ الطرف الآخر إخلالاً جوهرياً ولم يصححه خلال مدة المهلة الممنوحة له." },
  { title: "Termination", category: "termination", language: "en", body: "Either party may terminate this Agreement by giving {{notice_days}} days' prior written notice. The non-breaching party may terminate immediately if the other party commits a material breach and fails to remedy it within the cure period given to it." },
  { title: "الإخطارات", category: "notices", language: "ar", body: "تكون كل الإخطارات بين الطرفين كتابية وتُرسل إلى العناوين المبينة في هذا العقد أو إلى أي عنوان آخر يبلّغه أحد الطرفين للآخر كتابياً، وتعتبر مستلمة بعد مضي مدة التسليم المعتادة للبريد المسجّل أو بالتسليم باليد بإيصال موقّع." },
  { title: "Notices", category: "notices", language: "en", body: "All notices under this Agreement shall be in writing and sent to the addresses stated in this Agreement or any other address notified in writing, and shall be deemed received after the usual delivery period for registered mail or upon signed delivery by hand." },
];
