import webbrowser

def open_localhost_in_chrome():
    # Define the URL to open
    url = "http://localhost:3000"
    
    # Open the URL in Google Chrome
    chrome_path = "open -a /Applications/Google\\ Chrome.app %s"
    webbrowser.get(chrome_path).open(url)

if __name__ == "__main__":
    open_localhost_in_chrome()
