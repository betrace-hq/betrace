# Introduction

We are in the midst of a technological revolution that will fundamentally alter the way we live, work, and relate to one another. Artificial intelligence (AI) promises to transform many aspects of our society and economy.

The capabilities of AI systems have improved rapidly in many domains over the last years. Large language models (LLMs) are a particularly salient example. In 2019, GPT-2, then the most advanced LLM, could not reliably produce a coherent paragraph of text and could not always count to ten. Five years later, at the time of writing, the most powerful LLMs, such as **GPT-4, o1, Claude 3.5 Sonnet, Hunyuan-Large, and Gemini 1.5 Pro**, can engage consistently in multi-turn conversations, write short computer programs, translate between multiple languages, score highly on university entrance exams, and summarise long documents.

Because of these advances, AI is now increasingly present in our lives and is deployed in increasingly consequential settings across many domains. Just over the last two years, there has been rapid growth in AI adoption – ChatGPT, for instance, is amongst the fastest growing technology applications in history, reaching over **one million users just five days** after its launch, and **100 million users in two months**. AI is now being integrated into search engines, legal databases, clinical decision support tools, and many more products and services.

The step-change in AI capabilities and adoption, and the potential for continued progress, could help advance the public interest in many ways – but there are risks. Among the most promising prospects are AI's potential for education, medical applications, research advances in fields such as chemistry, biology, or physics, and generally increased prosperity thanks to AI-enabled innovation. Along with this rapid progress, experts are becoming increasingly aware of current harms and potential future risks associated with the most capable types of AI.

## Purpose and Genesis of This Report

This report aims to contribute to an internationally shared scientific understanding of advanced AI safety. To work towards a shared international understanding of the risks of advanced AI, government representatives and leaders from academia, business, and civil society convened in **Bletchley Park in the United Kingdom in November 2023** for the first international AI Safety Summit. At the Summit, the nations present agreed to support the development of an International AI Safety Report. This report will be presented at the **AI Action Summit held in Paris in February 2025**. An interim version of this report was published in May 2024 and presented at the AI Seoul Summit. At the Summit and in the weeks and months that followed, the experts writing this report received extensive feedback from scientists, companies, civil society organisations, and policymakers. This input has strongly informed the writing of the present report, which builds on the Interim Report and is the first full International AI Safety Report.

## Methodology and Evidence

An international group of **96 AI experts**, representing a breadth of views and, where relevant, a diversity of backgrounds, contributed to this report. They considered a range of relevant scientific, technical, and socio-economic evidence published before **5 December 2024**. Since the field of AI is developing rapidly, not all sources used for this report are peer-reviewed. However, the report is committed to citing only high-quality sources. Indicators for a source being of high quality include:

● The piece constitutes an original contribution that advances the field.
● The piece engages comprehensively with the existing scientific literature, references the work of others where appropriate, and interprets it accurately.
● The piece discusses possible objections to its claims in good faith.
● The piece clearly describes the methods employed for its analysis. It critically discusses the choice of methods.
● The piece clearly highlights its methodological limitations.
● The piece has been influential in the scientific community.

Since, at the time of writing this report, a scientific consensus on the risks from advanced AI is still being forged, in many cases the report does not put forward confident views. Rather, it offers a snapshot of the current state of scientific understanding and consensus, or lack thereof. Where there are gaps in the literature, the report identifies them, in the hope that this will be a spur to further research.

## Policy Neutrality

This report does not comment on which policies might be appropriate responses to AI risks. It aims to be highly relevant for AI policy, but not in any way prescriptive. Ultimately, policymakers have to choose how to balance the opportunities and risks that advanced AI poses. Policymakers must also choose the appropriate level of prudence and caution in response to risks that remain ambiguous.

## Focus: General-Purpose AI

The report focuses on '**general-purpose' AI**' – AI that can perform a wide range of tasks. AI is the field of computer science focused on creating systems or machines capable of performing tasks that typically require human intelligence. These tasks include learning, reasoning, problem-solving, natural language processing, and decision making. AI research is a broad and quickly evolving field of study, and there are many kinds of AI. This report does not address all potential risks from all types of advanced AI. It focuses on general-purpose AI, or AI that can perform a wide range of tasks. General-purpose AI, now known to many through applications such as ChatGPT, has generated unprecedented interest in AI, both among the public and policymakers, in the last two years. The capabilities of general-purpose AI have been improving particularly rapidly. General-purpose AI is different from so-called '**narrow AI**', a kind of AI that is specialised to perform one specific task or a few very similar tasks.

### AI Models vs. AI Systems

To better understand how this report defines general-purpose AI, it is useful to make a distinction between '**AI models**' and '**AI systems**'. AI models can be thought of as the raw, mathematical essence that is often the 'engine' of AI applications. An AI system is a combination of several components, including one or more AI models, that is designed to be particularly useful to humans in some way. For example, the ChatGPT app is an AI system; its core engine, GPT-4, is an AI model.

The report covers risks both from general-purpose AI models and from general-purpose AI systems. **For the purposes of this report:**

● An **AI model** is a general-purpose AI model if it can perform, or can be adapted to perform, a wide variety of tasks. If such a model is adapted to primarily perform a narrower set of tasks, it still counts as a general-purpose AI model.

● An **AI system** is a general-purpose AI system if it is based on a general-purpose AI model.

'Adapting a model' here refers to using techniques such as fine-tuning a model (training an already pre-trained model on a dataset that is significantly smaller than the previous dataset used for training), prompting it in specific ways ('prompt engineering'), and techniques for integrating the model into a broader system.

Large generative AI models and systems, such as chatbots based on LLMs, are well-known examples of general-purpose AI. They allow for flexible generation of output that can readily accommodate a wide range of distinct tasks. General-purpose AI also includes AIs that can perform a wide range of sufficiently distinct tasks within a specific domain such as structural biology.

Within the domain of general-purpose AI, this report focuses on general-purpose AI that is at least as capable as today's most advanced general-purpose AI. Examples include GPT-4o, AlphaFold-3, and Gemini 1.5 Pro. Note that in this report's definition, a model or system does not need to have multiple modalities – for example, speech, text, and images – to be considered general-purpose. What matters is the ability to perform a wide variety of tasks, which can also be accomplished by a model or system with only one modality.

### General-Purpose AI vs. AGI

General-purpose AI is not to be confused with '**artificial general intelligence**' (AGI). The term AGI lacks a universal definition but is typically used to refer to a potential future AI that equals or surpasses human performance on all or almost all cognitive tasks. By contrast, several of today's AI models and systems already meet the criteria for counting as general-purpose AI as defined in this report.

## What This Report Does NOT Cover

This report does not address risks from '**narrow AI**', which is trained to perform a specific task and captures a correspondingly very limited body of knowledge. The focus on advanced general-purpose AI is due to progress in this field having been most rapid, and the associated risks being less studied and understood. Narrow AI, however, can also be highly relevant from a risk and safety perspective, and evidence relating to the risks of these systems is used across the report.

Narrow AI models and systems are used in a vast range of products and services in fields such as medicine, advertising, or banking, and can pose significant risks. These risks can lead to harms such as biased hiring decisions, car crashes, or harmful medical treatment recommendations. Narrow AI is also used in various military applications, for instance; Lethal Autonomous Weapon Systems (LAWS). Such topics are covered in other fora and are outside the scope of this report. The scope of potential future reports is not yet decided.

## Contributors and Shared Conviction

A large and diverse group of leading international experts contributed to this report, including representatives nominated by **30 nations from all UN Regional Groups**, as well as the OECD, the EU, and the UN. While our individual views sometimes differ, we share the conviction that constructive scientific and public discourse on AI is necessary for people around the world to reap the benefits of this technology safely. We hope that this report can contribute to that discourse and be a foundation for future reports that will gradually improve our shared understanding of the capabilities and risks of advanced AI.

## Report Structure

The report is organised into five main sections: After this Introduction, **1. Capabilities of general-purpose AI** provides information on the current capabilities of general-purpose AI, underlying principles, and potential future trends. **2. Risks** discusses risks associated with general-purpose AI. **3. Technical approaches to risk management** presents technical approaches to mitigating risks from general-purpose AI and evaluates their strengths and limitations. The **Conclusion** summarises and concludes.
