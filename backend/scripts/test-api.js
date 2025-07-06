/**
 * API テストスクリプト
 * API test script for local development
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE = `http://localhost:${process.env.PORT || 3000}${process.env.API_PREFIX || '/api/v1'}`;

class APITester {
    constructor() {
        this.authToken = null;
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    async runTests() {
        console.log('🧪 API テスト開始...\n');
        console.log(`📡 API Base URL: ${API_BASE}\n`);

        try {
            // 基本機能テスト
            await this.testHealthCheck();
            await this.testUserRegistration();
            await this.testUserLogin();
            await this.testProtectedRoute();
            await this.testServicesAPI();
            
            // 結果表示
            this.displayResults();
            
        } catch (error) {
            console.error('❌ テスト実行エラー:', error.message);
            process.exit(1);
        }
    }

    async testHealthCheck() {
        await this.test('Health Check', async () => {
            const response = await axios.get(`${API_BASE.replace('/api/v1', '')}/health`);
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(response.data.status === 'OK', 'Status should be OK');
            return '✅ Server is running';
        });
    }

    async testUserRegistration() {
        await this.test('User Registration', async () => {
            const testUser = {
                username: `testuser_${Date.now()}`,
                email: `test_${Date.now()}@example.com`,
                password: 'password123',
                role: 'member'
            };

            try {
                const response = await axios.post(`${API_BASE}/auth/register`, testUser);
                this.assert(response.status === 201, 'Status should be 201');
                this.assert(response.data.token, 'Should return auth token');
                this.assert(response.data.user.username === testUser.username, 'Username should match');
                return `✅ User registered: ${testUser.username}`;
            } catch (error) {
                if (error.response?.status === 409) {
                    return '⚠️ User already exists (expected in test environment)';
                }
                throw error;
            }
        });
    }

    async testUserLogin() {
        await this.test('User Login', async () => {
            const loginData = {
                email: 'admin@ainaru-massage.com',
                password: 'admin123'
            };

            const response = await axios.post(`${API_BASE}/auth/login`, loginData);
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(response.data.token, 'Should return auth token');
            this.assert(response.data.user.role === 'admin', 'Should be admin user');
            
            this.authToken = response.data.token;
            return `✅ Admin login successful`;
        });
    }

    async testProtectedRoute() {
        await this.test('Protected Route Access', async () => {
            this.assert(this.authToken, 'Auth token should be available');

            const response = await axios.get(`${API_BASE}/auth/me`, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });
            
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(response.data.user, 'Should return user data');
            return `✅ Protected route accessible`;
        });
    }

    async testServicesAPI() {
        await this.test('Services API', async () => {
            // サービス一覧取得
            const response = await axios.get(`${API_BASE}/services`);
            this.assert(response.status === 200, 'Status should be 200');
            this.assert(Array.isArray(response.data.services), 'Should return services array');
            this.assert(response.data.pagination, 'Should return pagination info');
            
            if (response.data.services.length > 0) {
                // 個別サービス取得
                const serviceId = response.data.services[0].id;
                const serviceResponse = await axios.get(`${API_BASE}/services/${serviceId}`);
                this.assert(serviceResponse.status === 200, 'Service detail status should be 200');
                this.assert(serviceResponse.data.service.id === serviceId, 'Service ID should match');
            }
            
            return `✅ Services API working (${response.data.services.length} services found)`;
        });
    }

    async test(name, testFunction) {
        try {
            console.log(`🧪 ${name}...`);
            const result = await testFunction();
            console.log(`   ${result}\n`);
            this.results.passed++;
            this.results.tests.push({ name, status: 'PASSED', message: result });
        } catch (error) {
            const errorMsg = error.response ? 
                `HTTP ${error.response.status}: ${error.response.data?.message || error.message}` : 
                error.message;
            console.log(`   ❌ ${errorMsg}\n`);
            this.results.failed++;
            this.results.tests.push({ name, status: 'FAILED', message: errorMsg });
        }
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    displayResults() {
        console.log('📊 テスト結果:\n');
        console.log(`✅ 成功: ${this.results.passed}`);
        console.log(`❌ 失敗: ${this.results.failed}`);
        console.log(`📋 合計: ${this.results.tests.length}\n`);
        
        if (this.results.failed > 0) {
            console.log('❌ 失敗したテスト:');
            this.results.tests
                .filter(test => test.status === 'FAILED')
                .forEach(test => console.log(`   - ${test.name}: ${test.message}`));
            console.log('');
        }

        if (this.results.failed === 0) {
            console.log('🎉 全てのテストが成功しました!\n');
            console.log('📱 次のステップ:');
            console.log('1. Telegram Bot のテスト: npm run test:bot');
            console.log('2. フロントエンドでの動作確認');
            console.log('3. 予約フローの統合テスト\n');
        } else {
            console.log('⚠️ 一部のテストが失敗しました。エラーを修正してください。\n');
            process.exit(1);
        }
    }
}

// テスト実行前にサーバーの起動確認
async function checkServerStatus() {
    try {
        const response = await axios.get(`${API_BASE.replace('/api/v1', '')}/health`);
        return response.status === 200;
    } catch (error) {
        return false;
    }
}

async function main() {
    console.log('🚀 API テスト準備中...\n');
    
    // サーバー起動確認
    const serverRunning = await checkServerStatus();
    
    if (!serverRunning) {
        console.error('❌ サーバーが起動していません');
        console.log('以下のコマンドでサーバーを起動してください:');
        console.log('npm run start:backend\n');
        process.exit(1);
    }
    
    const tester = new APITester();
    await tester.runTests();
}

// axios追加
async function installAxios() {
    try {
        require('axios');
    } catch (error) {
        console.log('📦 axios をインストール中...');
        const { execSync } = require('child_process');
        execSync('npm install axios', { stdio: 'inherit' });
        console.log('✅ axios インストール完了\n');
    }
}

// メイン実行
installAxios().then(main).catch(console.error);