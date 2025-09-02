---
layout: post
title: "My Experience at CIT"
ref: experience-at-cit
---
{% include refs/experience-at-cit.md %}
Constructor Institute of Technology (CIT) is an institute
in Schaffhausen, Switzerland where I did two years
of my PhD on software verification with Eiffel.
Unfortunately, it was [decided to close CIT in 2025][close].
In this post I want to preserve links to some of the projects that we worked
on. 

I was part of the [Chair of Software Engineering][se]
led by [Bertrand Meyer][bm]. At my time there were
several PhD students besides me: [Li Huang][lh]
(she graduated and got her degree, congratulations!), [Alessandro Schena][as]
and [Reto Weber][rw]. Our research and teaching was supported
by [Marco Piccioni][mp].

## Static verification with AutoProof
Our research covered various fields of software engineering with
a focus on static verification. Our main product in this field
is [AutoProof][autoproof],
which is a part of [Reif][reif], the Research Eiffel environment. AutoProof
is a static program verifier for Eiffel programs. It means that
AutoProof can check if the implementation of procedures is consistent
with the contracts.

The majority of my code contribution was connected with 
implementing and expanding the approach described
in the paper ["The concept of class invariant in object-oriented programming"][inv]
of our Chair. Unfortunately, our work was interrupted by the closing
of the Institute.

## Do LLMs help fixing verified software?
The latest research we did at the Institute studied how well
LLM chats can help with fixing bugs when programmers have access to a verifier.
The report is called ["Do AI models help produce verified bug fixes?"][llm].

I think that software verification can tackle the randomness of LLM answers.
Verifier can check if a fix is really "correct" and not just "statistically
looks suitable".

25 software engineers were asked to fix bugs in programs. Some were allowed
to use a chat-bot and a verifier, some were allowed to work only with the verifier.

The results show that LLMs are most useful for complete novices
(produce at least something) and experts (quickly implement what was planned).
Developers of the medium expertise had less success with LLMs.

I [wrote more][llm-blog] about the experiment on the Chair's blog. Of course,
the paper provides more details.

## Future plans
There are more projects that we did at Constructor Institute of Technology
which I would like to highlight, but I will leave them for the next posts.
Subscribe to the [RSS feed][feed] in order not to miss them!

Overall, I am happy that I had an opportunity to work on advanced
software engineering topics in a skilled team led by Bertrand Meyer.
The work conditions were excellent and allowed us to focus on the research.
Personally, I find it sad that our work was interrupted so abruptly.

I hope that there will be an opportunity to connect with the team
and continue where we left off.

