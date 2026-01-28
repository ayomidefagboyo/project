"""
Email Expense Parser Service
Extracts expense data from bank debit alerts and transaction emails
"""

import re
import email
import imaplib
import ssl
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass
from email.mime.text import MIMEText
import logging

logger = logging.getLogger(__name__)

@dataclass
class ParsedExpense:
    """Parsed expense data from email"""
    amount: float
    merchant: str
    transaction_date: datetime
    account_number: str
    transaction_type: str
    raw_text: str
    confidence_score: float
    bank_name: Optional[str] = None
    category: Optional[str] = None

class EmailExpenseParser:
    """Parse expenses from bank debit alert emails"""

    def __init__(self):
        # Bank-specific email patterns
        self.bank_patterns = {
            'generic': {
                'amount': [
                    r'(?:amount|amt|sum|total)[:\s]*(?:NGN|₦|\$|USD|EUR|GBP)?\s*([\d,]+\.?\d*)',
                    r'(?:NGN|₦|\$|USD|EUR|GBP)\s*([\d,]+\.?\d*)',
                    r'([\d,]+\.?\d*)\s*(?:NGN|₦|\$|USD|EUR|GBP)'
                ],
                'merchant': [
                    r'(?:at|from|to|merchant)[:\s]+([A-Za-z0-9\s&\-\.]+)(?:\s+on|\s+dated|\s*$)',
                    r'(?:POS|ATM)[:\s]*([A-Za-z0-9\s&\-\.]+)',
                    r'Transaction[:\s]+([A-Za-z0-9\s&\-\.]+)'
                ],
                'date': [
                    r'(?:on|date|dated)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
                    r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
                    r'(\d{4}-\d{2}-\d{2})'
                ],
                'account': [
                    r'(?:account|acct|a/c)[:\s]*(\*+\d{4})',
                    r'(\*+\d{4})',
                    r'ending[:\s]+(\d{4})'
                ]
            },
            'gtbank': {
                'patterns': [
                    r'Debit Alert.*?NGN\s*([\d,]+\.?\d*)\s*.*?from\s+([A-Za-z0-9\s&\-\.]+)\s+.*?Acct:\s*(\*+\d{4})',
                    r'Your GTBank.*?debited.*?NGN\s*([\d,]+\.?\d*)\s*.*?at\s+([A-Za-z0-9\s&\-\.]+)'
                ]
            },
            'firstbank': {
                'patterns': [
                    r'Transaction Alert.*?Amount:\s*NGN\s*([\d,]+\.?\d*)\s*.*?Merchant:\s*([A-Za-z0-9\s&\-\.]+)',
                    r'Debit.*?NGN\s*([\d,]+\.?\d*)\s*.*?POS\s+([A-Za-z0-9\s&\-\.]+)'
                ]
            },
            'access_bank': {
                'patterns': [
                    r'Debit Transaction.*?NGN\s*([\d,]+\.?\d*)\s*.*?at\s+([A-Za-z0-9\s&\-\.]+)',
                    r'Your Access Bank.*?NGN\s*([\d,]+\.?\d*)\s*.*?Merchant:\s*([A-Za-z0-9\s&\-\.]+)'
                ]
            }
        }

    def parse_email_content(self, email_content: str, sender_email: str = "") -> Optional[ParsedExpense]:
        """Parse expense data from email content"""
        try:
            # Detect bank from sender email
            bank_name = self._detect_bank(sender_email)

            # Try bank-specific patterns first
            if bank_name and bank_name in self.bank_patterns:
                expense = self._parse_bank_specific(email_content, bank_name)
                if expense:
                    return expense

            # Fall back to generic patterns
            return self._parse_generic_patterns(email_content)

        except Exception as e:
            logger.error(f"Error parsing email content: {e}")
            return None

    def _detect_bank(self, sender_email: str) -> Optional[str]:
        """Detect bank from sender email address"""
        email_lower = sender_email.lower()

        bank_domains = {
            'gtbank': ['gtbank.com', 'guarantytrust'],
            'firstbank': ['firstbanknigeria.com', 'firstbank'],
            'access_bank': ['accessbankplc.com', 'accessbank'],
            'zenith': ['zenithbank.com'],
            'uba': ['ubagroup.com', 'uba'],
            'fidelity': ['fidelitybank.ng'],
            'sterling': ['sterlingbankng.com']
        }

        for bank, domains in bank_domains.items():
            if any(domain in email_lower for domain in domains):
                return bank

        return None

    def _parse_bank_specific(self, content: str, bank_name: str) -> Optional[ParsedExpense]:
        """Parse using bank-specific patterns"""
        patterns = self.bank_patterns.get(bank_name, {}).get('patterns', [])

        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
            if match:
                groups = match.groups()
                if len(groups) >= 2:
                    amount_str = groups[0].replace(',', '')
                    merchant = groups[1].strip()
                    account = groups[2] if len(groups) > 2 else "****"

                    try:
                        amount = float(amount_str)
                        return ParsedExpense(
                            amount=amount,
                            merchant=merchant,
                            transaction_date=datetime.now(),  # Will be refined
                            account_number=account,
                            transaction_type="debit",
                            raw_text=content,
                            confidence_score=0.9,
                            bank_name=bank_name
                        )
                    except ValueError:
                        continue

        return None

    def _parse_generic_patterns(self, content: str) -> Optional[ParsedExpense]:
        """Parse using generic patterns"""
        patterns = self.bank_patterns['generic']

        # Extract amount
        amount = None
        for pattern in patterns['amount']:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                try:
                    amount = float(match.group(1).replace(',', ''))
                    break
                except ValueError:
                    continue

        # Extract merchant
        merchant = None
        for pattern in patterns['merchant']:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                merchant = match.group(1).strip()
                break

        # Extract account number
        account = None
        for pattern in patterns['account']:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                account = match.group(1)
                break

        if amount and merchant:
            return ParsedExpense(
                amount=amount,
                merchant=merchant,
                transaction_date=datetime.now(),
                account_number=account or "****",
                transaction_type="debit",
                raw_text=content,
                confidence_score=0.7
            )

        return None

    def categorize_expense(self, expense: ParsedExpense) -> str:
        """Categorize expense based on merchant name"""
        merchant_lower = expense.merchant.lower()

        categories = {
            'food_beverage': ['restaurant', 'cafe', 'bar', 'food', 'kitchen', 'pizza', 'burger', 'chicken'],
            'fuel': ['filling', 'station', 'petrol', 'fuel', 'gas', 'mobil', 'shell', 'total'],
            'grocery': ['supermarket', 'grocery', 'market', 'shoprite', 'spar', 'jumia'],
            'transportation': ['uber', 'bolt', 'taxi', 'transport', 'bus'],
            'utilities': ['electric', 'power', 'water', 'phcn', 'nepa'],
            'entertainment': ['cinema', 'movie', 'game', 'sport'],
            'healthcare': ['hospital', 'clinic', 'pharmacy', 'medical'],
            'shopping': ['mall', 'store', 'shop', 'boutique'],
            'bank_charges': ['charge', 'fee', 'commission', 'maintenance']
        }

        for category, keywords in categories.items():
            if any(keyword in merchant_lower for keyword in keywords):
                return category

        return 'other'


class EmailConnector:
    """Connect to email accounts and fetch debit alerts"""

    def __init__(self):
        self.parser = EmailExpenseParser()

    async def connect_imap(self, email_address: str, password: str, imap_server: str) -> bool:
        """Connect to email via IMAP"""
        try:
            # Create SSL context
            context = ssl.create_default_context()

            # Connect to IMAP server
            mail = imaplib.IMAP4_SSL(imap_server, context=context)
            mail.login(email_address, password)

            # Test connection
            mail.select('INBOX')
            mail.logout()

            return True
        except Exception as e:
            logger.error(f"IMAP connection failed: {e}")
            return False

    async def fetch_debit_alerts(self,
                                email_address: str,
                                password: str,
                                imap_server: str,
                                days_back: int = 7) -> List[ParsedExpense]:
        """Fetch and parse debit alerts from email"""
        expenses = []

        try:
            context = ssl.create_default_context()
            mail = imaplib.IMAP4_SSL(imap_server, context=context)
            mail.login(email_address, password)
            mail.select('INBOX')

            # Search for debit alerts
            search_criteria = [
                'SUBJECT "debit"',
                'SUBJECT "transaction"',
                'SUBJECT "alert"',
                'FROM "bank"'
            ]

            for criteria in search_criteria:
                status, messages = mail.search(None, criteria)

                if status == 'OK':
                    for msg_id in messages[0].split():
                        status, msg_data = mail.fetch(msg_id, '(RFC822)')

                        if status == 'OK':
                            email_body = msg_data[0][1]
                            email_message = email.message_from_bytes(email_body)

                            # Extract content
                            content = self._extract_email_content(email_message)
                            sender = email_message.get('From', '')

                            # Parse expense
                            expense = self.parser.parse_email_content(content, sender)
                            if expense:
                                expense.category = self.parser.categorize_expense(expense)
                                expenses.append(expense)

            mail.logout()

        except Exception as e:
            logger.error(f"Error fetching emails: {e}")

        return expenses

    def _extract_email_content(self, email_message) -> str:
        """Extract text content from email message"""
        content = ""

        if email_message.is_multipart():
            for part in email_message.walk():
                if part.get_content_type() == "text/plain":
                    content += part.get_payload(decode=True).decode('utf-8', errors='ignore')
        else:
            content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')

        return content


# Example usage and testing
if __name__ == "__main__":
    # Test parsing
    parser = EmailExpenseParser()

    test_email = """
    Debit Alert: Your GTBank account ending in 1234 has been debited with NGN 5,500.00
    at SHOPRITE IKEJA on 24-11-2025. Available balance: NGN 45,000.00
    """

    expense = parser.parse_email_content(test_email, "alerts@gtbank.com")
    if expense:
        print(f"Amount: {expense.amount}")
        print(f"Merchant: {expense.merchant}")
        print(f"Category: {parser.categorize_expense(expense)}")