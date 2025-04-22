from flask import Flask, render_template, request, jsonify
import json
import os
import random

app = Flask(__name__)

class MindBinderGame:
    def __init__(self):
        self.questions_asked = []
        self.base_path = os.path.dirname(os.path.abspath(__file__))
        self.knowledge_base_path = os.path.join(self.base_path, 'knowledge_base.json')
        self.load_knowledge_base()
        self.confidence_scores = {item: 1.0 for item in self.possible_items}
        self.current_properties = {}
        self.min_questions = 2  # Reduced minimum questions
        
    def load_knowledge_base(self):
        try:
            with open(self.knowledge_base_path, 'r') as f:
                data = json.load(f)
                if not isinstance(data, dict) or 'items' not in data or 'questions' not in data:
                    raise ValueError("Invalid knowledge base format")
                self.possible_items = data.get('items', {})
                self.question_properties = data.get('questions', {})
                if not self.possible_items or not self.question_properties:
                    raise ValueError("Empty knowledge base")
        except (FileNotFoundError, json.JSONDecodeError, ValueError) as e:
            print(f"Error loading knowledge base: {e}. Creating default.")
            self.possible_items = {
                "cat": {
                    "living": True,
                    "holdable": True,
                    "daily_use": False,
                    "indoor": True,
                    "makes_sound": True,
                    "electronic": False,
                    "transportation": False,
                    "furniture": False
                }
            }
            self.question_properties = {
                "Is it a living thing?": "living",
                "Can you hold it in your hand?": "holdable",
                "Is it used daily?": "daily_use",
                "Is it found indoors?": "indoor",
                "Does it make sounds?": "makes_sound",
                "Is it electronic?": "electronic",
                "Is it used for transportation?": "transportation",
                "Is it a piece of furniture?": "furniture"
            }
            self.save_knowledge_base()
    
    def save_knowledge_base(self):
        try:
            with open(self.knowledge_base_path, 'w') as f:
                json.dump({
                    'items': self.possible_items,
                    'questions': self.question_properties
                }, f, indent=4)
        except IOError as e:
            print(f"Error saving knowledge base: {e}")
    
    def generate_question(self):
        # Ask predefined questions in order
        for question, property_name in self.question_properties.items():
            if question not in self.questions_asked:
                self.questions_asked.append(question)
                return question
        return None
    
    def update_probabilities(self, question, answer):
        property_name = self.question_properties.get(question)
        if property_name:
            # Store the answer for learning new items
            self.current_properties[property_name] = (answer.lower() == "yes")
            
            # Update confidence scores with more balanced weighting
            for item, properties in self.possible_items.items():
                if (answer.lower() == "yes") == properties[property_name]:
                    self.confidence_scores[item] *= 2.0  # Increased multiplier for matches
                else:
                    self.confidence_scores[item] *= 0.5  # Less severe penalty for mismatches

    def make_guess(self):
        if not self.possible_items:
            return None
            
        # Don't guess until minimum questions are asked
        if len(self.questions_asked) < self.min_questions:
            return None
            
        sorted_items = sorted(self.confidence_scores.items(), key=lambda x: x[1], reverse=True)
        best_confidence = sorted_items[0][1]
        
        # More lenient confidence threshold
        if best_confidence >= 0.3:  # Reduced from 0.5
            guess = sorted_items[0][0]
            self.reset_game()
            return guess
            
        # If we've asked all questions but still no confident guess
        if len(self.questions_asked) >= len(self.question_properties):
            if sorted_items:  # Just make our best guess
                guess = sorted_items[0][0]
                self.reset_game()
                return guess
            
        return None
    
    def learn_new_item(self, item_name):
        if not self.current_properties:
            return False
        
        # Ensure all properties are set
        for prop in self.question_properties.values():
            if prop not in self.current_properties:
                self.current_properties[prop] = False
        
        # Add the new item with properties collected during questioning
        self.possible_items[item_name] = self.current_properties.copy()
        self.save_knowledge_base()
        self.reset_game()
        return True
    
    def reset_game(self):
        self.questions_asked = []
        self.confidence_scores = {item: 1.0 for item in self.possible_items}
        self.current_properties = {}

# Create game instance
game = MindBinderGame()

# Routes
@app.route('/')
def home():
    return render_template('index.html')

@app.route('/ask_question', methods=['POST'])
def ask_question():
    try:
        # Try to get the next question first
        question = game.generate_question()
        if question:
            return jsonify({"question": question})
        
        # If no more questions, try to make a guess
        guess = game.make_guess()
        if guess:
            return jsonify({"guess": guess})
        
        # If no confident guess, ask to learn
        return jsonify({"unknown": True})
    except Exception as e:
        print(f"Error generating question/guess: {e}")  # For debugging
        return jsonify({"error": str(e)}), 500

@app.route('/submit_answer', methods=['POST'])
def submit_answer():
    try:
        data = request.json
        if not data or 'question' not in data or 'answer' not in data:
            return jsonify({"error": "Invalid request data"}), 400
        
        question = data.get('question')
        answer = data.get('answer')
        game.update_probabilities(question, answer)
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Error processing answer: {e}")  # For debugging
        return jsonify({"error": str(e)}), 500

@app.route('/learn_item', methods=['POST'])
def learn_item():
    try:
        data = request.json
        if not data or 'item_name' not in data:
            return jsonify({"error": "No item name provided"}), 400
        
        new_item = data.get('item_name').lower().strip()
        if not new_item:
            return jsonify({"error": "Invalid item name"}), 400
            
        if new_item in game.possible_items:
            return jsonify({"error": "Item already exists"}), 400
            
        if game.learn_new_item(new_item):
            return jsonify({
                "status": "success",
                "message": f"Learned about {new_item}"
            })
        else:
            return jsonify({
                "error": "Not enough information to learn the item"
            }), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)