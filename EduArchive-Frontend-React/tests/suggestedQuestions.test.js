import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSuggestedQuestions } from '../src/components/chatbotHelpers.js';

test('generateSuggestedQuestions returns general discovery questions when capstone is null', () => {
    const questions = generateSuggestedQuestions(null);
    assert.ok(Array.isArray(questions));
    assert.ok(questions.length >= 3);
    assert.ok(questions.some(q => q.toLowerCase().includes('capstone') || q.toLowerCase().includes('topic')));
});

test('generateSuggestedQuestions generates document-grounded questions when activeCapstone is provided', () => {
    const capstone = {
        id: 101,
        title: 'IoT Soil Moisture Monitoring System',
        program: 'BS Information Technology',
        category: 'Internet of Things',
    };
    const questions = generateSuggestedQuestions(capstone);
    assert.ok(Array.isArray(questions));
    assert.ok(questions.length >= 4);
    assert.ok(questions.some(q => q.toLowerCase().includes('methodology') || q.toLowerCase().includes('technologies')));
    assert.ok(questions.some(q => q.toLowerCase().includes('findings') || q.toLowerCase().includes('results')));
    assert.ok(questions.some(q => q.toLowerCase().includes('gaps') || q.toLowerCase().includes('limitations')));
});

test('generateSuggestedQuestions incorporates capstone title or topic', () => {
    const capstone = {
        id: 202,
        title: 'Face Recognition Attendance System',
        category: 'Artificial Intelligence',
    };
    const questions = generateSuggestedQuestions(capstone);
    assert.ok(questions.some(q => q.includes('Face Recognition') || q.toLowerCase().includes('hardware') || q.toLowerCase().includes('algorithm') || q.toLowerCase().includes('methodology')));
});
