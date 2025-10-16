# Executive Summary

## The purpose of this report

**This report synthesises the state of scientific understanding of general-purpose AI – AI that can perform a wide variety of tasks – with a focus on understanding and managing its risks.**

This report summarises the scientific evidence on the safety of general-purpose AI. The purpose of this report is to help create a shared international understanding of risks from advanced AI and how they can be mitigated. To achieve this, this report focuses on general-purpose AI – or AI that can perform a wide variety of tasks – since this type of AI has advanced particularly rapidly in recent years and has been deployed widely by technology companies for a range of consumer and business purposes. The report synthesises the state of scientific understanding of general-purpose AI, with a focus on understanding and managing its risks.

Amid rapid advancements, research on general-purpose AI is currently in a time of scientific discovery, and – in many cases – is not yet settled science. The report provides a snapshot of the current scientific understanding of general-purpose AI and its risks. This includes identifying areas of scientific consensus and areas where there are different views or gaps in the current scientific understanding.

People around the world will only be able to fully enjoy the potential benefits of general-purpose AI safely if its risks are appropriately managed. This report focuses on identifying those risks and evaluating technical methods for assessing and mitigating them, including ways that general-purpose AI itself can be used to mitigate risks. It does not aim to comprehensively assess all possible societal impacts of general-purpose AI. Most notably, the current and potential future benefits of general-purpose AI – although they are vast – are beyond this report's scope. Holistic policymaking requires considering both the potential benefits of general-purpose AI and the risks covered in this report. It also requires taking into account that other types of AI have different risk/benefit profiles compared to current general-purpose AI.

The three main sections of the report summarise the scientific evidence on three core questions: What can general-purpose AI do? What are risks associated with general-purpose AI? And what mitigation techniques are there against these risks?

---

## Section 1 – Capabilities of general-purpose AI: What can general-purpose AI do now and in the future?

### General-purpose AI capabilities have improved rapidly in recent years, and further advancements could be anything from slow to extremely rapid.

What AI can do is a key contributor to many of the risks it poses, and according to many metrics, general-purpose AI capabilities have been progressing rapidly. Five years ago, the leading general-purpose AI language models could rarely produce a coherent paragraph of text. Today, some general-purpose AI models can engage in conversations on a wide range of topics, write computer programs, or generate realistic short videos from a description. However, it is technically challenging to reliably estimate and describe the capabilities of general-purpose AI.

AI developers have rapidly improved the capabilities of general-purpose AI in recent years, mostly through '**scaling**'.† They have continually increased the resources used for training new models (this is often referred to as 'scaling') and refined existing approaches to use those resources more efficiently. For example, according to recent estimates, state-of-the-art AI models have seen annual increases of approximately **4x in computational resources ('compute') used for training** and **2.5x in training dataset size**.

The pace of future progress in general-purpose AI capabilities has substantial implications for managing emerging risks, but experts disagree on what to expect even in the coming months and years. Experts variously support the possibility of general-purpose AI capabilities advancing slowly, rapidly, or extremely rapidly.

Experts disagree about the pace of future progress because of different views on the promise of further 'scaling' – and companies are exploring an additional, new type of scaling that might further accelerate capabilities.† While scaling has often overcome the limitations of previous systems, experts disagree about its potential to resolve the remaining limitations of today's systems, such as unreliability at acting in the physical world and at executing extended tasks on computers. In recent months, a new type of scaling has shown potential for further improving capabilities: rather than just scaling up the resources used for training models, AI companies are also increasingly interested in '**inference scaling**' – letting an already trained model use more computation to solve a given problem, for example to improve on its own solution, or to write so-called 'chains of thought' that break down the problem into simpler steps.

Several leading companies that develop general-purpose AI are betting on 'scaling' to continue leading to performance improvements. If recent trends continue, by the end of 2026 some general-purpose AI models will be trained using roughly **100x more training compute** than 2023's most compute-intensive models, growing to **10,000x more training compute by 2030**, combined with algorithms that achieve greater capabilities for a given amount of available computation. In addition to this potential scaling of training resources, recent trends such as inference scaling and using models to generate training data could mean that even more compute will be used overall. However, there are potential bottlenecks to further increasing both data and compute rapidly, such as the availability of data, AI chips, capital, and local energy capacity. Companies developing general-purpose AI are working to navigate these potential bottlenecks.

### Since the publication of the Interim Report (May 2024), general-purpose AI has reached expert-level performance in some tests and competitions for scientific reasoning and programming, and companies have been making large efforts to develop autonomous AI agents.

Advances in science and programming have been driven by inference scaling techniques such as writing long 'chains of thought'. New studies suggest that further scaling such approaches, for instance allowing models to analyse problems by writing even longer chains of thought than today's models, could lead to further advances in domains where reasoning matters more, such as science, software engineering, and planning. In addition to this trend, companies are making large efforts to develop more advanced **general-purpose AI agents**, which can plan and act autonomously to work towards a given goal. Finally, the market price of using general-purpose AI of a given capability level has dropped sharply, making this technology more broadly accessible and widely used.

This report focuses primarily on technical aspects of AI progress, but how fast general-purpose AI will advance is not a purely technical question. The pace of future advancements will also depend on non-technical factors, potentially including the approaches that governments take to regulating AI. This report does not discuss how different approaches to regulation might affect the speed of development and adoption of general-purpose AI.

† Please refer to the Chair's update on the latest AI advances after the writing of this report.

---

## Section 2 – Risks: What are risks associated with general-purpose AI?

### Several harms from general-purpose AI are already well-established. As general-purpose AI becomes more capable, evidence of additional risks is gradually emerging.

This report classifies general-purpose AI risks into three categories: **malicious use risks**; **risks from malfunctions**; and **systemic risks**. Each of these categories contains risks that have already materialised as well as risks that might materialise in the next few years.

### Risks from malicious use
Malicious actors can use general-purpose AI to cause harm to individuals, organisations, or society. Forms of malicious use include:

#### Harm to individuals through fake content
Malicious actors can currently use general-purpose AI to generate fake content that harms individuals in a targeted way. These malicious uses include non-consensual 'deepfake' pornography and AI-generated CSAM, financial fraud through voice impersonation, blackmail for extortion, sabotage of personal and professional reputations, and psychological abuse. However, while incident reports of harm from AI-generated fake content are common, reliable statistics on the frequency of these incidents are still lacking.

#### Manipulation of public opinion
General-purpose AI makes it easier to generate persuasive content at scale. This can help actors who seek to manipulate public opinion, for instance to affect political outcomes. However, evidence on how prevalent and how effective such efforts are remains limited. Technical countermeasures like content watermarking, although useful, can usually be circumvented by moderately sophisticated actors.

#### Cyber offence
General-purpose AI can make it easier or faster for malicious actors of varying skill levels to conduct cyberattacks. Current systems have demonstrated capabilities in low- and medium-complexity cybersecurity tasks, and state-sponsored actors are actively exploring AI to survey target systems. New research has confirmed that the capabilities of general-purpose AI related to cyber offence are significantly advancing, but it remains unclear whether this will affect the balance between attackers and defenders.

#### Biological and chemical attacks
Recent general-purpose AI systems have displayed some ability to provide instructions and troubleshooting guidance for reproducing known biological and chemical weapons and to facilitate the design of novel toxic compounds. In new experiments that tested for the ability to generate plans for producing biological weapons, a general-purpose AI system sometimes performed better than human experts with access to the internet. In response, one AI company increased its assessment of biological risk from its best model from 'low' to 'medium'. However, real-world attempts to develop such weapons still require substantial additional resources and expertise. A comprehensive assessment of biological and chemical risk is difficult because much of the relevant research is classified.

**Since the publication of the Interim Report**, general-purpose AI has become more capable in domains that are relevant for malicious use. For example, researchers have recently built general-purpose AI systems that were able to find and exploit some cybersecurity vulnerabilities on their own and, with human assistance, discover a previously unknown vulnerability in widely used software. General-purpose AI capabilities related to reasoning and to integrating different types of data, which can aid research on pathogens or in other dual-use fields, have also improved.

### Risks from malfunctions
General-purpose AI can also cause unintended harm. Even when users have no intention to cause harm, serious risks can arise due to the malfunctioning of general-purpose AI. Such malfunctions include:

#### Reliability issues
Current general-purpose AI can be unreliable, which can lead to harm. For example, if users consult a general-purpose AI system for medical or legal advice, the system might generate an answer that contains falsehoods. Users are often not aware of the limitations of an AI product, for example due to limited 'AI literacy', misleading advertising, or miscommunication. There are a number of known cases of harm from reliability issues, but still limited evidence on exactly how widespread different forms of this problem are.

#### Bias
General-purpose AI systems can amplify social and political biases, causing concrete harm. They frequently display biases with respect to race, gender, culture, age, disability, political opinion, or other aspects of human identity. This can lead to discriminatory outcomes including unequal resource allocation, reinforcement of stereotypes, and systematic neglect of underrepresented groups or viewpoints. Technical approaches for mitigating bias and discrimination in general-purpose AI systems are advancing, but face trade-offs between bias mitigation and competing objectives such as accuracy and privacy, as well as other challenges.

#### Loss of control
'Loss of control' scenarios are hypothetical future scenarios in which one or more general-purpose AI systems come to operate outside of anyone's control, with no clear path to regaining control. There is broad consensus that current general-purpose AI lacks the capabilities to pose this risk. However, expert opinion on the likelihood of loss of control within the next several years varies greatly: some consider it implausible, some consider it likely to occur, and some see it as a modest-likelihood risk that warrants attention due to its high potential severity. Ongoing empirical and mathematical research is gradually advancing these debates.

**Since the publication of the Interim Report**, new research has led to some new insights about risks of bias and loss of control. The evidence of bias in general-purpose AI systems has increased, and recent work has detected additional forms of AI bias. Researchers have observed modest further advancements towards AI capabilities that are likely necessary for commonly discussed loss of control scenarios to occur. These include capabilities for autonomously using computers, programming, gaining unauthorised access to digital systems, and identifying ways to evade human oversight.

### Systemic risks
Beyond the risks directly posed by capabilities of individual models, widespread deployment of general-purpose AI is associated with several broader systemic risks. Examples of systemic risks range from potential labour market impacts to privacy risks and environmental effects:

#### Labour market risks
General-purpose AI, especially if it continues to advance rapidly, has the potential to automate a very wide range of tasks, which could have a significant effect on the labour market. This means that many people could lose their current jobs. However, many economists expect that potential job losses could be offset, partly or potentially even completely, by the creation of new jobs and by increased demand in non-automated sectors.

#### Global AI R&D divide
General-purpose AI research and development (R&D) is currently concentrated in a few Western countries and China. This 'AI divide' has the potential to increase much of the world's dependence on this small set of countries. Some experts also expect it to contribute to global inequality. The divide has many causes, including a number of causes that are not unique to AI. However, in significant part it stems from differing levels of access to the very expensive compute needed to develop general-purpose AI: most low- and middle-income countries (LMICs) have significantly less access to compute than high-income countries (HICs).

#### Market concentration and single points of failure
A small number of companies currently dominate the market for general-purpose AI. This market concentration could make societies more vulnerable to several systemic risks. For instance, if organisations across critical sectors, such as finance or healthcare, all rely on a small number of general-purpose AI systems, then a bug or vulnerability in such a system could cause simultaneous failures and disruptions on a broad scale.

#### Environmental risks
Growing compute use in general-purpose AI development and deployment has rapidly increased the amounts of energy, water, and raw material consumed in building and operating the necessary compute infrastructure. This trend shows no clear indication of slowing, despite progress in techniques that allow compute to be used more efficiently. General-purpose AI also has a number of applications that can either benefit or harm sustainability efforts.

#### Privacy risks
General-purpose AI can cause or contribute to violations of user privacy. For example, sensitive information that was in the training data can leak unintentionally when a user interacts with the system. In addition, when users share sensitive information with the system, this information can also leak. But general-purpose AI can also facilitate deliberate violations of privacy, for example if malicious actors use AI to infer sensitive information about specific individuals from large amounts of data. However, so far, researchers have not found evidence of widespread privacy violations associated with general-purpose AI.

#### Copyright infringements
General-purpose AI both learns from and creates works of creative expression, challenging traditional systems of data consent, compensation, and control. Data collection and content generation can implicate a variety of data rights laws, which vary across jurisdictions and may be under active litigation. Given the legal uncertainty around data collection practices, AI companies are sharing less information about the data they use. This opacity makes third-party AI safety research harder.

**Since the publication of the Interim Report**, additional evidence on the labour market impacts of general-purpose AI has emerged, while new developments have heightened privacy and copyrights concerns. New analyses of labour market data suggest that individuals are adopting general-purpose AI very rapidly relative to previous technologies. The pace of adoption by businesses varies widely by sector. In addition, recent advances in capabilities have led to general-purpose AI being deployed increasingly in sensitive contexts such as healthcare or workplace monitoring, which creates new privacy risks. Finally, as copyright disputes intensify and technical mitigations to copyright infringements remain unreliable, data rights holders have been rapidly restricting access to their data.

### Open-weight models
An important factor in evaluating many risks that a general-purpose AI model might pose is how it is released to the public. So-called '**open-weight models**' are AI models whose central components, called 'weights', are shared publicly for download. Open-weight access facilitates research and innovation, including in AI safety, as well as increasing transparency and making it easier for the research community to detect flaws in models. However, open-weight models can also pose risks, for example by facilitating malicious or misguided use that is difficult or impossible for the developer of the model to monitor or mitigate. Once model weights are available for public download, there is no way to implement a wholesale rollback of all existing copies or ensure that all existing copies receive safety updates. Since the Interim Report, high-level consensus has emerged that risks posed by greater AI openness should be evaluated in terms of '**marginal**' risk: the extent to which releasing an open-weight model would increase or decrease a given risk, relative to risks posed by existing alternatives such as closed models or other technologies.

---

## Section 3 – Risk management: What techniques are there for managing risks from general-purpose AI?

### Several technical approaches can help manage risks, but in many cases the best available approaches still have highly significant limitations and no quantitative risk estimation or guarantees that are available in other safety-critical domains.

Risk management – identifying and assessing risks, and then mitigating and monitoring them – is difficult in the context of general-purpose AI. Although risk management has also been highly challenging in many other domains, there are some features of general-purpose AI that appear to create distinctive difficulties.

### Technical challenges for risk management

Several technical features of general-purpose AI make risk management in this domain particularly difficult. They include, among others:

#### Broad range of uses
The range of possible uses and use contexts for general-purpose AI systems is unusually broad. For example, the same system may be used to provide medical advice, analyse computer code for vulnerabilities, and generate photos. This increases the difficulty of comprehensively anticipating relevant use cases, identifying risks, or testing how systems will behave in relevant real-world circumstances.

#### Limited understanding of internal operations
Developers still understand little about how their general-purpose AI models operate. This lack of understanding makes it more difficult both to predict behavioural issues and to explain and resolve known issues once they are observed. Understanding remains elusive mainly because general-purpose AI models are not programmed in the traditional sense. Instead, they are trained: AI developers set up a training process that involves a large volume of data, and the outcome of that training process is the general-purpose AI model. The inner workings of these models are largely inscrutable, including to the model developers. Model explanation and '**interpretability**' techniques can improve researchers' and developers' understanding of how general-purpose AI models operate, but, despite recent progress, this research remains nascent.

#### AI agents present new challenges
Increasingly capable AI agents – general-purpose AI systems that can autonomously act, plan, and delegate to achieve goals – will likely present new, significant challenges for risk management. AI agents typically work towards goals autonomously by using general software such as web browsers and programming tools. Currently, most are not yet reliable enough for widespread use, but companies are making large efforts to build more capable and reliable AI agents and have made progress in recent months. AI agents will likely become increasingly useful, but may also exacerbate a number of the risks discussed in this report and introduce additional difficulties for risk management. Examples of such potential new challenges include the possibility that users might not always know what their own AI agents are doing, the potential for AI agents to operate outside of anyone's control, the potential for attackers to 'hijack' agents, and the potential for AI-to-AI interactions to create complex new risks. Approaches for managing risks associated with agents are only beginning to be developed.

### Societal challenges for risk management

Besides technical factors, several economic, political, and other societal factors make risk management in the field of general-purpose AI particularly difficult.

#### The evidence dilemma
The pace of advancement in general-purpose AI creates an '**evidence dilemma**' for decision-makers.† Rapid capability advancement makes it possible for some risks to emerge in leaps; for example, the risk of academic cheating using general-purpose AI shifted from negligible to widespread within a year. The more quickly a risk emerges, the more difficult it is to manage the risk reactively and the more valuable preparation becomes. However, so long as evidence for a risk remains incomplete, decision-makers also cannot know for sure whether the risk will emerge or perhaps even has already emerged. This creates a trade-off: implementing pre-emptive or early mitigation measures might prove unnecessary, but waiting for conclusive evidence could leave society vulnerable to risks that emerge rapidly. Companies and governments are developing early warning systems and risk management frameworks that may reduce this dilemma. Some of these trigger specific mitigation measures when there is new evidence of risks, while others require developers to provide evidence of safety before releasing a new model.

#### Information gap
There is an information gap between what AI companies know about their AI systems and what governments and non-industry researchers know. Companies often share only limited information about their general-purpose AI systems, especially in the period before they are widely released. Companies cite a mixture of commercial concerns and safety concerns as reasons to limit information sharing. However, this information gap also makes it more challenging for other actors to participate effectively in risk management, especially for emerging risks.

#### Competitive pressure
Both AI companies and governments often face strong competitive pressure, which may lead them to deprioritise risk management. In some circumstances, competitive pressure may incentivise companies to invest less time or other resources into risk management than they otherwise would. Similarly, governments may invest less in policies to support risk management in cases where they perceive trade-offs between international competition and risk reduction.

### Risk management techniques and frameworks

Nonetheless, there are various techniques and frameworks for managing risks from general-purpose AI that companies can employ and regulators can require. These include methods for identifying and assessing risks, as well as methods for mitigating and monitoring them.

#### Risk assessment limitations
Assessing general-purpose AI systems for risks is an integral part of risk management, but existing risk assessments are severely limited. Existing evaluations of general-purpose AI risk mainly rely on '**spot checks**', i.e. testing the behaviour of a general-purpose AI in a set of specific situations. This can help surface potential hazards before deploying a model. However, existing tests often miss hazards and overestimate or underestimate general-purpose AI capabilities and risks, because test conditions differ from the real world.

#### Requirements for effective evaluation
For risk identification and assessment to be effective, evaluators need substantial expertise, resources, and sufficient access to relevant information. Rigorous risk assessment in the context of general-purpose AI requires combining multiple evaluation approaches. These range from technical analyses of the models and systems themselves to evaluations of possible risks from certain use patterns. Evaluators need substantial expertise to conduct such evaluations correctly. For comprehensive risk assessments, they often also need more time, more direct access to the models and their training data, and more information about the technical methodologies used than the companies developing general-purpose AI typically provide.

#### Training for safety
There has been progress in training general-purpose AI models to function more safely, but no current method can reliably prevent even overtly unsafe outputs. For example, a technique called '**adversarial training**' involves deliberately exposing AI models to examples designed to make them fail or misbehave during training, aiming to build resistance to such cases. However, adversaries can still find new ways ('attacks') to circumvent these safeguards with low to moderate effort. In addition, recent evidence suggests that current training methods – which rely heavily on imperfect human feedback – may inadvertently incentivise models to mislead humans on difficult questions by making errors harder to spot. Improving the quantity and quality of this feedback is an avenue for progress, though nascent training techniques using AI to detect misleading behaviour also show promise.

#### Monitoring and intervention
Monitoring – identifying risks and evaluating performance once a model is already in use – and various interventions to prevent harmful actions can improve the safety of a general-purpose AI after it is deployed to users. Current tools can detect AI-generated content, track system performance, and identify potentially harmful inputs/outputs, though moderately skilled users can often circumvent these safeguards. Several layers of defence that combine technical monitoring and intervention capabilities with human oversight improve safety but can introduce costs and delays. In the future, hardware-enabled mechanisms could help customers and regulators to monitor general-purpose AI systems more effectively during deployment and potentially help verify agreements across borders, but reliable mechanisms of this kind do not yet exist.

#### Privacy safeguards
Multiple methods exist across the AI lifecycle to safeguard privacy. These include removing sensitive information from training data, model training approaches that control how much information is learned from data (such as '**differential privacy**' approaches), and techniques for using AI with sensitive data that make it hard to recover the data (such as '**confidential computing**' and other privacy-enhancing technologies). Many privacy-enhancing methods from other research fields are not yet applicable to general-purpose AI systems due to the computational requirements of AI systems. In recent months, privacy protection methods have expanded to address AI's growing use in sensitive domains including smartphone assistants, AI agents, always-listening voice assistants, and use in healthcare or legal practice.

**Since the publication of the Interim Report**, researchers have made some further progress towards being able to explain why a general-purpose AI model has produced a given output. Being able to explain AI decisions could help manage risks from malfunctions ranging from bias and factual inaccuracy to loss of control. In addition, there have been growing efforts to standardise assessment and mitigation approaches around the world.

† Please refer to the Chair's update on the latest AI advances after the writing of this report.

---

## Conclusion: A wide range of trajectories for the future of general-purpose AI are possible, and much will depend on how societies and governments act

The future of general-purpose AI is uncertain, with a wide range of trajectories appearing possible even in the near future, including both very positive and very negative outcomes. But nothing about the future of general-purpose AI is inevitable. How general-purpose AI gets developed and by whom, which problems it gets designed to solve, whether societies will be able to reap general-purpose AI's full economic potential, who benefits from it, the types of risks we expose ourselves to, and how much we invest into research to manage risks – these and many other questions depend on the choices that societies and governments make today and in the future to shape the development of general-purpose AI.

To help facilitate constructive discussion about these decisions, this report provides an overview of the current state of scientific research and discussion on managing the risks of general-purpose AI. The stakes are high. We look forward to continuing this effort.
