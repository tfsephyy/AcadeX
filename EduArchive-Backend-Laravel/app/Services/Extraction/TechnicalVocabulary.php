<?php

namespace App\Services\Extraction;

/** Explicit computing vocabulary; extend here when supporting another domain. */
final class TechnicalVocabulary
{
    public const TERMS = [
        // Languages, frameworks and databases. Avoid ambiguous single words such as "go" or "r".
        'php', 'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'c programming', 'golang', 'go programming',
        'rust', 'kotlin', 'swift', 'dart', 'ruby', 'html', 'css', 'sql', 'r programming', 'matlab', 'visual basic',
        'laravel', 'react', 'react native', 'vue', 'vue.js', 'angular', 'next.js', 'node.js', 'express.js',
        'django', 'flask', 'fastapi', 'spring boot', 'asp.net', '.net', 'flutter', 'bootstrap', 'tailwind css',
        'jquery', 'mysql', 'postgresql', 'sqlite', 'mongodb', 'mariadb', 'redis', 'firebase', 'supabase', 'sql server',
        // Document processing, architectures and IT concepts.
        'pdf extraction', 'data extraction', 'metadata extraction', 'text extraction', 'optical character recognition',
        'ocr', 'tesseract', 'pdf parsing', 'natural language processing', 'nlp', 'information retrieval',
        'document management', 'document management system', 'digital repository', 'capstone repository',
        'web-based repository', 'web-based system', 'web application', 'web development', 'search functionality',
        'database', 'database management', 'database management system', 'relational database', 'nosql',
        'metadata', 'data mining', 'data analytics', 'data visualization', 'data processing', 'data validation',
        'encryption', 'decryption', 'authentication', 'authorization', 'access control', 'role-based access control',
        'cybersecurity', 'cryptography', 'hashing', 'blockchain', 'two-factor authentication', 'multi-factor authentication',
        'api', 'rest api', 'restful api', 'graphql', 'websocket', 'microservices', 'client-server',
        'client-server architecture', 'model-view-controller', 'mvc', 'cloud computing', 'serverless computing',
        'distributed system', 'distributed systems', 'caching', 'load balancing', 'version control', 'git',
        'docker', 'kubernetes', 'linux', 'android', 'ios', 'aws', 'amazon web services', 'microsoft azure', 'google cloud',
        // Algorithms, methods and testing.
        'algorithm', 'algorithms', 'machine learning', 'artificial intelligence', 'deep learning',
        'neural network', 'neural networks', 'convolutional neural network', 'recurrent neural network',
        'decision tree', 'random forest', 'support vector machine', 'naive bayes', 'k-means',
        'knn', 'k-nearest neighbors', 'linear regression', 'logistic regression', 'tf-idf',
        'term frequency', 'cosine similarity', 'binary search', 'dijkstra', 'collaborative filtering',
        'content-based filtering', 'recommendation system', 'image processing', 'computer vision', 'speech recognition',
        'software development', 'software engineering', 'software architecture', 'agile methodology',
        'scrum', 'waterfall model', 'rapid application development', 'sdlc', 'software development life cycle',
        'object-oriented programming', 'test-driven development', 'unit testing', 'integration testing',
        'usability testing', 'black-box testing', 'white-box testing', 'responsive design', 'user interface', 'user experience',
        // Hardware, networking and embedded systems.
        'iot', 'internet of things', 'rfid', 'nfc', 'qr code', 'barcode', 'arduino', 'raspberry pi',
        'esp32', 'esp8266', 'microcontroller', 'sensor network', 'wireless sensor network', 'bluetooth',
        'wi-fi', 'tcp/ip', 'http', 'https', 'mqtt', 'gps', 'gsm', 'gis', 'geographic information system',
        'biometrics', 'facial recognition', 'fingerprint recognition', 'embedded system', 'embedded systems',
    ];
}
