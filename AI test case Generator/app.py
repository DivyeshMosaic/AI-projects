import re
import streamlit as st
from transformers import pipeline
import pandas as pd

# ---------------- CONFIG ----------------
MODEL_NAME = "google/flan-t5-large"
st.set_page_config(page_title="AI Test Case Generator", page_icon="🧠", layout="centered")

# ---------------- STYLING ----------------
st.markdown("""
    <style>
    body {
        background: radial-gradient(circle at 20% 30%, #0f172a 0%, #1e293b 50%, #020617 100%);
        color: #f8fafc;
        font-family: 'Segoe UI', Roboto, sans-serif;
    }
    body::before {
        content: "";
        position: fixed; top: 0; left: 0; width: 200%; height: 200%;
        background: repeating-linear-gradient(
            45deg, rgba(56,189,248,0.04) 0, rgba(56,189,248,0.04) 1px, transparent 1px, transparent 40px
        ),
        repeating-linear-gradient(
            -45deg, rgba(99,102,241,0.04) 0, rgba(99,102,241,0.04) 1px, transparent 1px, transparent 40px
        );
        animation: moveBg 30s linear infinite; z-index: -1;
    }
    @keyframes moveBg {0%{transform:translate(0,0);}100%{transform:translate(-100px,-100px);}}
    .main-card {
        background: rgba(255,255,255,0.05);
        backdrop-filter: blur(14px);
        padding: 2rem 2.5rem;
        border-radius: 20px;
        box-shadow: 0 4px 25px rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.1);
    }
    .title {
        text-align: center;
        font-size: 2.3rem;
        font-weight: 800;
        background: linear-gradient(90deg,#38bdf8,#818cf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-shadow: 0px 0px 12px rgba(56,189,248,0.3);
    }
    .subtitle {
        text-align: center; color: #94a3b8;
        font-size: 0.95rem; margin-bottom: 1.2rem;
    }
    .stTextArea textarea {
        background-color: #0f172a; color: #f8fafc;
        border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
    }
    .stButton button {
        width: 100%; border-radius: 10px; padding: 10px 0;
        font-size: 1rem; font-weight: 600;
        background: linear-gradient(90deg,#2563eb,#06b6d4);
        color: white; border: none;
        box-shadow: 0 0 10px rgba(56,189,248,0.4);
        transition: 0.3s;
    }
    .stButton button:hover {
        transform: scale(1.03);
        background: linear-gradient(90deg,#06b6d4,#2563eb);
        box-shadow: 0 0 15px rgba(56,189,248,0.6);
    }
    </style>
""", unsafe_allow_html=True)

# ---------------- HEADER ----------------
st.markdown('<div class="title">🧠 AI Test Case Generator</div>', unsafe_allow_html=True)
st.markdown('<div class="subtitle">Generate 5 smart, realistic test case titles instantly (Free + Public)</div>', unsafe_allow_html=True)

# ---------------- MODEL ----------------
@st.cache_resource
def load_model():
    return pipeline("text2text-generation", model=MODEL_NAME)

generator = load_model()

# ---------------- PROMPT ----------------
def build_prompt(story):
    return f"""
You are a professional QA engineer.

From the following user story, write exactly five unique, short, and realistic test case titles.
Each test case must start with a dash (-).
Avoid repetition and single-word responses.

Example:
- Verify successful logout redirects to login page.
- Verify session token is cleared after logout.
- Verify multiple logout requests handled gracefully.
- Verify user cannot access dashboard post logout.
- Verify logout link visible on all pages.

User Story: {story}
"""

# ---------------- HELPERS ----------------
def clean_text(text):
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    seen, uniq = set(), []
    for l in lines:
        key = re.sub(r"[^a-z0-9]+", "", l.lower())
        if key not in seen:
            seen.add(key)
            uniq.append(l)
    return "\n".join(uniq)

def parse_output(text):
    items = re.findall(r"[-•]\s*(.*)", text)
    rows = [{"#": idx + 1, "Test Case Title": i.strip()} for idx, i in enumerate(items) if i.strip()]
    return rows

def generate_testcases(story):
    if len(story.split()) < 10:
        story += " This includes validation, security, and user experience scenarios."
    prompt = build_prompt(story)
    res = generator(
        prompt,
        max_length=150,
        do_sample=True,
        top_p=0.9,
        temperature=0.7,
        repetition_penalty=2.2,
        num_return_sequences=1
    )
    text = res[0]["generated_text"].strip()
    return clean_text(text)

# ---------------- UI ----------------
with st.container():
    st.markdown('<div class="main-card">', unsafe_allow_html=True)
    st.subheader("📘 Enter your User Story")
    user_story = st.text_area(
        "",
        placeholder="e.g., I want to validate logout functionality.",
        height=120
    )
    col1, col2 = st.columns(2)
    with col1:
        gen = st.button("🚀 Generate Test Cases")
    with col2:
        regen = st.button("🔁 Regenerate")
    st.markdown("</div>", unsafe_allow_html=True)

# ---------------- GENERATION LOGIC ----------------
if gen or regen:
    if not user_story.strip():
        st.warning("⚠️ Please enter a user story first.")
    else:
        with st.spinner("✨ Generating test cases..."):
            output = generate_testcases(user_story.strip())

        st.subheader("✅ Generated Test Cases")
        st.text_area("Raw Model Output", output, height=200)

        rows = parse_output(output)
        if rows:
            df = pd.DataFrame(rows)
            st.dataframe(df, use_container_width=True, hide_index=True)
            csv = df.to_csv(index=False).encode("utf-8")
            st.download_button(
                "⬇️ Download as CSV",
                data=csv,
                file_name="AI_Test_Cases.csv",
                mime="text/csv"
            )
        else:
            st.warning("⚠️ Could not extract test cases properly. Review raw output above.")

# ---------------- FOOTER ----------------
st.markdown("""
---
<div style='text-align:center;color:#94a3b8;font-size:0.9rem;'>
Built with ❤️ by <b>Divyesh QA Labs</b> • Powered by Hugging Face + Streamlit
</div>
""", unsafe_allow_html=True)
