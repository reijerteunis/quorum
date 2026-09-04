# Product context

Read by the product managers and the head of product before any requirement is written
or judged. This file — not the Studio — is where your product lives. Fill it in once per
repository; ten honest lines beat a hundred vague ones.

## What the product is
One paragraph: what it does, for whom, how it makes money.

## Personas
A table: id, persona, who they are, what they care about. Name the persona in every user
story; "user" is not a persona.

## Surfaces
Which apps/sites/services exist and who uses each. A requirement must say which it touches.

## Domain vocabulary
The exact words for your core entities. List forbidden synonyms; agents will otherwise
invent them.

## Quality pillars
The non-negotiables every requirement must carry acceptance criteria for (accessibility,
performance budgets, SEO, compliance, …).

## What a good requirement looks like here
Problem in the persona's words · user story per persona · numbered, independently testable
acceptance criteria naming the surface · explicit non-goals · open questions with an owner
(one that would change the data model is a blocker) · cross-cutting checklist (i18n,
analytics, auth, schema, shared components), even if "n/a".

## Current priorities
Two or three lines; edit as they change.
