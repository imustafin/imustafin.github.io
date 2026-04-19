require 'minitest/autorun'
require 'nokogiri'

class IndexTest < Minitest::Test
  def load_page(s)
    File.open(File.join(__dir__, '..', '_site', s)) do |f|
      Nokogiri::HTML(f)
    end
  end

  def title(p)
    p.at('title').content.strip
  end
  
  def test_en_index
    page = load_page('/index.html')
    assert_equal(
      'Ilgiz Mustafin: software engineering & formal verification',
      title(page)
    )
  end

  def test_ru_index
    page = load_page('/ru/index.html')
    assert_equal(
      'Мустафин Ильгиз: разработка и формальная верификация ПО',
      title(page)
    )
  end

  def test_tt_index
    page = load_page('/tt/index.html')
    assert_equal(
      'Мустафин Ильгиз: программа төзү һәм формаль верификация',
      title(page)
    )
  end
end
