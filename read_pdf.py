import sys
try:
    import PyPDF2
    with open('/home/nithu/Music/lead/Robointech_AI_Growth_Readiness_Report_Template.pdf', 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            print(page.extract_text())
except Exception as e:
    print(f"Error: {e}")
