import re
import streamlit as st
from transformers import pipeline

# --- Page setup ---
st.set_page_config(page_title="ContextQA", page_icon="🧠", layout="centered")

st.title("🧠 ContextQA")
st.write(
    "Hey there! I’m ContextQA, your friendly reading assistant built by Divyesh, I’ll answer only using what’s inside it"
)

@st.cache_resource
def load_model():
    return pipeline("text2text-generation", model="google/flan-t5-base")

qa = load_model()

CURRENCY_PATTERN = r"(₹|\$|Rs\.?|INR)?"

def try_solve_math(context: str, question: str):
    """
    Parses simple math problems like:
    '3 pencils for ₹10 each, 2 notebooks for ₹25 each, paid ₹100'
    Returns (currency_symbol, answer_string) if solved, else (None, None)
    """
    text = f"{context}\n{question}".lower()
    if not any(k in text for k in ["how much", "how many", "total", "left", "change", "get back", "amount"]):
        return None, None

    ctx = context.replace(",", " ")

    # --- detect currency used ---
    currency_match = re.search(r"(₹|\$|Rs\.?|INR)", ctx)
    currency_symbol = currency_match.group(1) if currency_match else ""

    # --- find 'X items for Y each' patterns ---
    item_pattern = re.compile(
        rf"(?P<count>\d+)\s+[\w-]+\s+(?:for|at)\s*{CURRENCY_PATTERN}\s*(?P<price>\d+)\s*(?:each|ea\.?)",
        re.IGNORECASE
    )

    subtotal = 0
    for m in item_pattern.finditer(ctx):
        count = int(m.group("count"))
        price = int(m.group("price"))
        subtotal += count * price

    # --- find 'paid ₹100' style ---
    paid_pattern = re.compile(
        rf"(?:paid|gave|handed over|paid with)\s*(?:a|an)?\s*{CURRENCY_PATTERN}\s*(\d+)",
        re.IGNORECASE
    )
    paid_match = paid_pattern.search(ctx)

    if subtotal > 0:
        if paid_match:
            paid_str = paid_match.group(1)
            if paid_str.isdigit():
                paid = int(paid_str)
                change = paid - subtotal
                if any(k in text for k in ["get back", "change", "left", "balance"]):
                    return currency_symbol, str(change)
        # total cost
        if any(k in text for k in ["total", "amount", "cost", "price"]):
            return currency_symbol, str(subtotal)

    return None, None


# --- UI ---
context = st.text_area(
    "📘 Paste your context or passage here:",
    placeholder="Ravi bought 3 pencils for ₹10 each and 2 notebooks for ₹25 each.\nHe paid with a ₹100 note."
)
question = st.text_input(
    "❓ Enter your question:",
    placeholder="How much money did he get back?"
)

if st.button("🔍 Get Answer"):
    if context.strip() and question.strip():
        # Try deterministic math first
        symbol, math_answer = try_solve_math(context, question)
        if math_answer is not None:
            st.success("✅ Answer (math mode):")
            st.write(f"{symbol}{math_answer}" if symbol else math_answer)
        else:
            with st.spinner("Thinking..."):
                prompt = (
                    "Answer the question based only on the context below. "
                    "If the context doesn't contain the answer, say exactly: "
                    "'The context does not provide this information.'\n\n"
                    f"Context:\n{context}\n\nQuestion: {question}\nAnswer:"
                )
                result = qa(prompt, max_length=100, do_sample=False)
                answer = result[0]["generated_text"].strip()
            st.success("✅ Answer:")
            st.write(answer)
    else:
        st.warning("Please enter both a context and a question.")
