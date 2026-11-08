<?php

namespace App\Services\Extraction;

/** Research and capstone vocabulary, suggested only when present in the PDF. */
final class ResearchVocabulary
{
    public const TERMS = [
        'capstone', 'capstone project', 'research', 'research project', 'research study',
        'research methodology', 'research design', 'methodology', 'literature review',
        'related literature', 'related studies', 'conceptual framework', 'theoretical framework',
        'qualitative research', 'quantitative research', 'mixed methods', 'descriptive research',
        'experimental research', 'case study', 'action research', 'applied research',
        'data collection', 'data analysis', 'statistical analysis', 'statistical treatment',
        'sampling', 'random sampling', 'purposive sampling', 'sample size', 'respondents',
        'participants', 'survey', 'questionnaire', 'interview', 'observation',
        'hypothesis', 'validity', 'reliability', 'likert scale', 'weighted mean',
        'standard deviation', 'correlation', 'anova', 't-test', 'p-value',
        'feasibility study', 'needs assessment', 'requirements analysis', 'system analysis',
        'system design', 'system development', 'prototype', 'prototyping', 'implementation',
        'evaluation', 'usability', 'acceptability', 'functionality', 'efficiency',
        'maintainability', 'portability', 'user acceptance testing', 'iso 25010', 'iso/iec 25010',
        'research ethics', 'informed consent', 'data privacy', 'academic research',
    ];
}
