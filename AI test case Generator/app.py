import re
import streamlit as st
from transformers import pipeline
import pandas as pd

# --- Basic Config ---
MODEL_NAME = "google/flan-t5-large"

st.set_page_config(page_title="AI Test Case Generator", page_icon="🧠", layout="wide")
st.markdown("""
    <style>
        body { background-color: #0f1720; color: #e6eef8; }
        .stTextArea textarea { background-color: #0b1220; color: #e6eef8; }
        .stButton button { border-radius: 8px; padding: 10px 18px; background-color: #0083B0; color: white; font-weight: 600; }
        .stDownloadButton button { border-radius: 8px; background-color: #00B4DB; color: white; font-weight: 600; }
        .block-container { padding: 1.5rem 2rem; }
    </style>
""", unsafe_allow_html=True)

st.title("🧠 AI Test Case Generator")
st.caption("Built by Divyesh QA Labs • Generate Positive, Negative, and Edge test cases from user stories.")

# --- Load model ---
@st.cache_resource
def load_model():
    return pipeline("text2text-generation", model=MODEL_NAME)

generator = load_model()

# --- Input ---
st.subheader("Enter your user story or requirement")
user_story = st.text_area(
    "",
    placeholder="e.g., As a customer, I want to reset my password using email OTP so that I can regain access to my account.",
    height=120
)

# --- Helper Functions ---
few_shot_example = """
Example:
User Story: As a user, I want to log in using my email and password so that I can access my account dashboard.

Test Cases:
Positive:
1. Verify that a valid user can log in successfully.
2. Verify that the 'Remember me' option keeps the user logged in.

Negative:
1. Verify that an incorrect password shows an error message.
2. Verify that a non-registered email shows a 'user not found' message.

Edge:
1. Verify login with empty fields shows validation errors.
2. Verify login attempt rate limiting after multiple failed logins.
"""

def build_prompt(story):
    return f"""
You are a senior QA engineer. Based on the following user story, create detailed software test cases grouped as Positive, Negative, and Edge cases.

Follow this structure strictly:
{few_shot_example}

Now, based on this story:
User Story: {story}

Test Cases:
"""

def parse_output_to_rows(output_text):
    sections = re.split(r"\n(?=[A-Za-z ]+:)", output_text)
    rows = []
    current_category = "Uncategorized"
    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        header_match = re.match(r"^(Positive|Negative|Edge)", sec, re.I)
        if header_match:
            current_category = header_match.group(1).capitalize()
            sec_body = sec[header_match.end():].strip()
        else:
            sec_body = sec
        items = re.split(r"\n\d+\.\s+", "\n" + sec_body)
        for it in items:
            it = it.strip()
            if it:
                it = re.sub(r"^\d+[\)\.\-]?\s*", "", it)
                rows.append({"Category": current_category, "Test Case": it})
    return rows

# --- Generate Button ---
if st.button("🚀 Generate Test Cases"):
    if not user_story.strip():
        st.warning("Please enter a user story first.")
    else:
        prompt = build_prompt(user_story.strip())
        with st.spinner("Generating test cases..."):
            result = generator(prompt, max_length=512, do_sample=True, top_p=0.95, temperature=0.2)
            text = result[0]['generated_text'].strip()

        st.subheader("✅ Generated Test Cases")
        st.text_area("Raw Output", text, height=220)

        rows = parse_output_to_rows(text)
        if rows:
            df = pd.DataFrame(rows)
            st.dataframe(df, use_container_width=True)
            csv = df.to_csv(index=False).encode("utf-8")
            st.download_button("⬇️ Download as CSV", data=csv, file_name="generated_test_cases.csv", mime="text/csv")
        else:
            st.warning("Could not categorize test cases properly. Please check the raw output above.")

st.markdown("---")
st.caption("💡 Tip: If results repeat or are short, try a more descriptive user story.")
